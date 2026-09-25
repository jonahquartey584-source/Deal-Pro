import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { accounts, jobs, currentWeek, currentSearchWeek, refundJob, ADMIN_EMAIL, FREE_ANALYSES, FREE_SEARCHES_PER_WEEK, LEVELS, WEEK_MS, WEEKLY_CREDITS, type LevelId, type Reserved, type Usage } from "../lib/ai.mts";

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
  const sweek = currentSearchWeek(usage);
  const weekly = isAdmin || free ? null : WEEKLY_CREDITS[plan] ?? 0;
  // Per-level credit costs are deliberately not sent to the browser.
  return {
    plan: isAdmin ? "Admin" : plan,
    free,
    freeLeft: free ? Math.max(0, FREE_ANALYSES - (Number(usage.count) || 0)) : null,
    freeSearchesLeft: free ? Math.max(0, FREE_SEARCHES_PER_WEEK - sweek.searchWeekUsed) : null,
    searchResetsAt: free && sweek.searchWeekStart ? new Date(Date.parse(sweek.searchWeekStart) + WEEK_MS).toISOString() : null,
    weeklyCredits: weekly,
    creditsLeft: weekly === null ? null : Math.max(0, weekly - week.weekUsed),
    resetsAt: weekly !== null && week.weekStart ? new Date(Date.parse(week.weekStart) + WEEK_MS).toISOString() : null,
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

  // kind "analyse": one deal from the AI Deal Analyser. kind "rank": Deal Finder results to rank.
  const body = await request.json().catch(() => null) as { kind?: string; deal?: string; level?: string; listings?: unknown; filters?: unknown } | null;
  const kind = body?.kind === "rank" ? "rank" : "analyse";
  const level = (body?.level && body.level in LEVELS ? body.level : "quick") as LevelId;
  let input: string;
  if (kind === "analyse") {
    input = body?.deal?.trim() || "";
    if (!input) return json({ error: "Paste the property advert or deal details first." }, 400);
    if (input.length > 30_000) return json({ error: "Deal details must be under 30,000 characters." }, 413);
  } else {
    const listings = Array.isArray(body?.listings) ? body.listings.slice(0, 80) : [];
    if (!listings.length) return json({ error: "There are no results to rank." }, 400);
    input = JSON.stringify({ filters: body?.filters ?? {}, listings });
    if (input.length > 60_000) return json({ error: "Too many results to rank. Narrow your filters." }, 413);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    return json({ error: "The AI is temporarily unavailable. Please try again later." }, 503);
  }

  // Limits are checked and credits reserved here, where the browser can't change them.
  const next: Usage = { ...usage };
  const reserved: Reserved = {};
  if (!isAdmin && plan === "Free") {
    if (level !== "quick") return json({ error: "Upgrade to use Analyst and Expert." }, 402);
    if (kind === "analyse") {
      if ((Number(usage.count) || 0) >= FREE_ANALYSES) {
        return json({ error: `You've used your ${FREE_ANALYSES} free analyses. Subscribe to keep analysing deals.` }, 402);
      }
      next.count = (Number(usage.count) || 0) + 1;
      reserved.count = 1;
    } else {
      const sweek = currentSearchWeek(usage);
      if (sweek.searchWeekUsed >= FREE_SEARCHES_PER_WEEK) {
        const resets = sweek.searchWeekStart ? new Date(Date.parse(sweek.searchWeekStart) + WEEK_MS).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : "next week";
        return json({ error: `You've used your ${FREE_SEARCHES_PER_WEEK} free searches this week. They reset ${resets}. Upgrade for more.` }, 402);
      }
      next.searchWeekStart = sweek.searchWeekStart || new Date().toISOString();
      next.searchWeekUsed = sweek.searchWeekUsed + 1;
      reserved.searches = 1;
    }
  } else if (!isAdmin) {
    const cost = LEVELS[level].credits;
    const week = currentWeek(usage);
    if (week.weekUsed + cost > (WEEKLY_CREDITS[plan] ?? 0)) {
      return json({ error: "You don't have enough credits left this week for this level. Try Scout, or upgrade for more credits." }, 402);
    }
    next.weekStart = week.weekStart || new Date().toISOString();
    next.weekUsed = week.weekUsed + cost;
    reserved.credits = cost;
    if (kind === "analyse") { next.count = (Number(usage.count) || 0) + 1; reserved.count = 1; }
  }
  await store.setJSON(`users/${user.id}/ai-usage`, { ...next, updatedAt: new Date().toISOString() });

  const jobId = crypto.randomUUID();
  const runToken = crypto.randomUUID();
  await jobs().setJSON(jobId, {
    userId: user.id, kind, level, input, reserved,
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
