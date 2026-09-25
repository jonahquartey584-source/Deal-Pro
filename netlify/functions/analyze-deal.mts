import OpenAI from "openai";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const FREE_ANALYSES = 2;

const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to analyse a deal." }, 401);

  const body = await request.json().catch(() => null) as { deal?: string } | null;
  const deal = body?.deal?.trim();
  if (!deal) return json({ error: "Paste the property advert or deal details first." }, 400);
  if (deal.length > 30_000) return json({ error: "Deal details must be under 30,000 characters." }, 413);

  // Plan and free-usage limits are checked here, where the browser can't change them.
  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const state = await store.get(`users/${user.id}/state`, { type: "json" }) as Record<string, unknown> | null;
  if (!isAdmin && state?.accountEnabled === false) {
    return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
  }
  const usageKey = `users/${user.id}/ai-usage`;
  const usage = (await store.get(usageKey, { type: "json" }) as { count?: number } | null) || {};
  const used = Number(usage.count) || 0;
  const onFreePlan = !isAdmin && (!state?.plan || state.plan === "Free");
  if (onFreePlan && used >= FREE_ANALYSES) {
    return json({ error: `You've used your ${FREE_ANALYSES} free analyses. Subscribe for unlimited analyses.` }, 402);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    return json({ error: "The AI analyser is temporarily unavailable. Please try again later." }, 503);
  }

  let analysis: unknown;
  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Deal Pro's UK property deal analyst. Analyse rent-to-rent and rent-to-serviced-accommodation opportunities conservatively. Never invent missing figures or claim that legal/planning/licensing checks are complete. Return valid JSON with exactly these keys: verdict (one of Strong, Potential, Weak, Insufficient information), summary (plain English, max 80 words), score (integer 0-100), monthly_profit (string), upfront_cash (string), break_even (string), risks (array of short strings), missing_information (array of short strings), next_actions (array of short strings). Clearly flag the London 90-night rule when relevant and tell the user to verify licensing, planning, lease/mortgage, insurance, landlord consent, and figures with qualified professionals.`,
        },
        { role: "user", content: deal },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return json({ error: "The AI did not return an analysis. Please try again." }, 502);
    analysis = JSON.parse(content);
  } catch (error) {
    console.error("Deal analysis failed", error);
    return json({ error: "The analysis could not be completed. Please try again in a moment." }, 502);
  }

  await store.setJSON(usageKey, { count: used + 1, updatedAt: new Date().toISOString() });
  return json({ analysis });
};

export const config: Config = {
  path: "/api/analyze-deal",
  method: "POST",
};
