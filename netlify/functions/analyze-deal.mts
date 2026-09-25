import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { accounts, jobs, currentWeek, refundJob, ADMIN_EMAIL, FREE_ANALYSES, LEVELS, WEEK_MS, WEEKLY_CREDITS, type LevelId, type Usage } from "../lib/ai.mts";

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

async function loadAccount(userId: string) {
  const store = accounts();
  const state = await store.get(`users/${userId}/state`, { type: "json" }) as Record<string, unknown> | null;
  const usage = (await store.get(`users/${userId}/ai-usage`, { type: "json" }) as Usage | null) || {};
  return { store, state, usage };
}

function creditSummary(isAdmin: boolean, plan: string, usage: Usage) {
  const free = !isAdmin && plan === "Free";
  const week = currentWeek(usage);
  const weekly = isAdmin ? null : WEEKLY_CREDITS[plan] ?? 0;
  return {
    plan: isAdmin ? "Admin" : plan,
    free,
    freeLeft: free ? Math.max(0, FREE_ANALYSES - (Number(usage.count) || 0)) : null,
    weeklyCredits: weekly,
    creditsLeft: weekly === null ? null : Math.max(0, weekly - week.weekUsed),
    resetsAt: week.weekStart ? new Date(Date.parse(week.weekStart) + WEEK_MS).toISOString() : null,
    levels: Object.fromEntries(Object.entries(LEVELS).map(([id, l]) => [id, { credits: l.credits }])),
  };
}

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to analyse a deal." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const { store, state, usage } = await loadAccount(user.id);
  const plan = String(state?.plan || "Free");
  if (!isAdmin && state?.accountEnabled === false) {
    return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
  }

  if (request.method === "GET") {
    const jobId = new URL(request.url).searchParams.get("job");
    if (!jobId) return json(creditSummary(isAdmin, plan, usage));
    if (!/^[0-9a-f-]{36}$/.test(jobId)) return json({ error: "Unknown analysis." }, 404);
    const job = await jobs().get(jobId, { type: "json" }) as Record<string, unknown> | null;
    if (!job || job.userId !== user.id) return json({ error: "Unknown analysis." }, 404);
    // A job that never started or stalled is failed and refunded after 16 minutes.
    if (job.status !== "done" && job.status !== "error" && Date.now() - Date.parse(String(job.createdAt)) > 16 * 60 * 1000) {
      job.error = "The analysis took too long. Your credits have not been used; please try again.";
      await refundJob(jobId, job, String(job.error));
      job.status = "error";
    }
    // Finished jobs are deleted once collected, so the deal text isn't kept.
    if (job.status === "done" || job.status === "error") await jobs().delete(jobId);
    return json({
      status: job.status,
      analysis: job.status === "done" ? job.analysis : undefined,
      error: job.error,
      credits: creditSummary(isAdmin, plan, (await store.get(`users/${user.id}/ai-usage`, { type: "json" }) as Usage | null) || {}),
    });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const body = await request.json().catch(() => null) as { deal?: string; level?: string } | null;
  const deal = body?.deal?.trim();
  const level = (body?.level && body.level in LEVELS ? body.level : "quick") as LevelId;
  if (!deal) return json({ error: "Paste the property advert or deal details first." }, 400);
  if (deal.length > 30_000) return json({ error: "Deal details must be under 30,000 characters." }, 413);
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    return json({ error: "The AI analyser is temporarily unavailable. Please try again later." }, 503);
  }

  // Limits are checked and credits reserved here, where the browser can't change them.
  const next: Usage = { ...usage };
  const cost = isAdmin ? 0 : LEVELS[level].credits;
  if (!isAdmin && plan === "Free") {
    if (level !== "quick") return json({ error: "Upgrade to use Analyst and Expert." }, 402);
    if ((Number(usage.count) || 0) >= FREE_ANALYSES) {
      return json({ error: `You've used your ${FREE_ANALYSES} free analyses. Subscribe for unlimited analyses.` }, 402);
    }
    next.count = (Number(usage.count) || 0) + 1;
  } else if (cost > 0) {
    const week = currentWeek(usage);
    const allowance = WEEKLY_CREDITS[plan] ?? 0;
    if (week.weekUsed + cost > allowance) {
      return json({ error: `Not enough credits left this week for this level (it uses ${cost}). Try a lighter level, or upgrade for more credits.` }, 402);
    }
    next.weekStart = week.weekStart || new Date().toISOString();
    next.weekUsed = week.weekUsed + cost;
    next.count = (Number(usage.count) || 0) + 1;
  } else {
    next.count = (Number(usage.count) || 0) + 1;
  }
  await store.setJSON(`users/${user.id}/ai-usage`, { ...next, updatedAt: new Date().toISOString() });

  const jobId = crypto.randomUUID();
  const runToken = crypto.randomUUID();
  await jobs().setJSON(jobId, {
    userId: user.id, level, deal, cost, freeUse: !isAdmin && plan === "Free",
    runToken, status: "queued", createdAt: new Date().toISOString(),
  });

  const run = await fetch(new URL("/api/analyze-deal-run", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, runToken }),
  }).catch((error) => { console.error("Could not start analysis", error); return null; });
  if (!run || run.status >= 400) {
    await store.setJSON(`users/${user.id}/ai-usage`, { ...usage, updatedAt: new Date().toISOString() });
    await jobs().delete(jobId);
    return json({ error: "The analysis could not be started. Please try again." }, 502);
  }

  return json({ jobId, credits: creditSummary(isAdmin, plan, next) }, 202);
};

export const config: Config = {
  path: "/api/analyze-deal",
  method: ["GET", "POST"],
};
