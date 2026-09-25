import OpenAI from "openai";
import { getStore } from "@netlify/blobs";

export const ADMIN_EMAIL = "jonahquartey584@gmail.com";
export const FREE_ANALYSES = 2;
export const FREE_SEARCHES_PER_WEEK = 3;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Power levels. Names shown to users live in index.html (AI_LEVELS); ids here must match.
export type LevelId = "quick" | "standard" | "deep";
type Effort = "low" | "medium" | "high";
export const LEVELS: Record<LevelId, { credits: number; model: string; effort: Effort }> = {
  quick: { credits: 1, model: process.env.AI_MODEL_QUICK || "gpt-5.4-mini", effort: "low" },
  standard: { credits: 2, model: process.env.AI_MODEL_STANDARD || "gpt-5.5", effort: "medium" },
  deep: { credits: 5, model: process.env.AI_MODEL_DEEP || "gpt-5.5", effort: "high" },
};
const FALLBACK_MODEL = "gpt-5-mini";

// Weekly credits on paid plans, shared by deal analyses and Deal Finder searches at every level.
export const WEEKLY_CREDITS: Record<string, number> = { Pro: 60, Max5: 300, Max20: 1200, TeamStd: 60, TeamPrem: 300 };

export const accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });
export const jobs = () => getStore({ name: "deal-analysis-jobs", consistency: "strong" });

export type Usage = {
  count?: number; weekStart?: string | null; weekUsed?: number;
  searchWeekStart?: string | null; searchWeekUsed?: number;
};
// What a job took, so a failed job gives back exactly that.
export type Reserved = { count?: number; credits?: number; searches?: number };

export function currentWeek(usage: Usage, now = Date.now()) {
  const start = usage.weekStart ? Date.parse(usage.weekStart) : NaN;
  if (!Number.isFinite(start) || now - start >= WEEK_MS) return { weekStart: null as string | null, weekUsed: 0 };
  return { weekStart: usage.weekStart as string, weekUsed: Number(usage.weekUsed) || 0 };
}

export function currentSearchWeek(usage: Usage, now = Date.now()) {
  const start = usage.searchWeekStart ? Date.parse(usage.searchWeekStart) : NaN;
  if (!Number.isFinite(start) || now - start >= WEEK_MS) return { searchWeekStart: null as string | null, searchWeekUsed: 0 };
  return { searchWeekStart: usage.searchWeekStart as string, searchWeekUsed: Number(usage.searchWeekUsed) || 0 };
}

// Gives back what a failed or stalled job reserved, once.
export async function refundJob(jobId: string, job: Record<string, unknown>, error: string) {
  if (job.refunded) return;
  const r = (job.reserved || {}) as Reserved;
  const usageKey = `users/${job.userId}/ai-usage`;
  const usage = (await accounts().get(usageKey, { type: "json" }) as Usage | null) || {};
  const week = currentWeek(usage);
  const sweek = currentSearchWeek(usage);
  await accounts().setJSON(usageKey, {
    ...usage,
    count: Math.max(0, (Number(usage.count) || 0) - (r.count || 0)),
    weekUsed: week.weekStart ? Math.max(0, week.weekUsed - (r.credits || 0)) : 0,
    searchWeekUsed: sweek.searchWeekStart ? Math.max(0, sweek.searchWeekUsed - (r.searches || 0)) : 0,
    updatedAt: new Date().toISOString(),
  });
  await jobs().setJSON(jobId, { ...job, status: "error", runToken: null, refunded: true, error });
}

const BASE_PROMPT = `You are Deal Pro's UK property deal analyst for rent-to-rent (R2R), rent-to-serviced-accommodation (R2SA), buy-to-let (BTL), HMO, BRRR, lease option and flip deals.

Work from the figures the user gives. Never invent missing figures: when you need an assumption (for example a nightly rate, occupancy, cleaning cost or platform fee), state it in "assumptions" and label estimated numbers "(est.)". Use UK conventions and pounds sterling.

For R2SA and serviced accommodation, model monthly profit at 60%, 80% and 100% occupancy over 30 nights: revenue = nights x nightly rate; subtract platform fees (assume 15% if not given), cleaning per stay (assume £45 and a 3-night average stay if not given), rent, bills and other running costs. For R2R and HMO, model rent received per room against rent, bills and voids. For purchases, show yield and cash flow after mortgage if the figures allow.

Always flag compliance: the London 90-night short-let limit when the property is in London, HMO licensing and Article 4 areas, planning use class, the lease or mortgage permitting subletting or short lets, landlord consent in writing, insurance, fire safety and deposit protection. Tell the user to verify these with qualified professionals.

Return valid JSON with exactly these keys:
verdict (one of "Strong", "Potential", "Weak", "Insufficient information"),
summary (plain English, max 80 words),
score (integer 0-100),
monthly_profit (string, the realistic case),
upfront_cash (string),
break_even (string, e.g. occupancy needed to break even),
occupancy_scenarios (array of {"occupancy": string, "monthly_profit": string}; empty if not a short-let deal),
assumptions (array of short strings),
risks (array of short strings),
missing_information (array of short strings),
next_actions (array of short strings).`;

const LEVEL_PROMPT: Record<LevelId, string> = {
  quick: "Give a fast first look: the headline numbers, the verdict and the three most important risks. Keep lists short.",
  standard: "Give a full analysis: work through the numbers carefully, cover all material risks and give clear next steps.",
  deep: `Give a thorough, investment-committee-grade analysis. Double-check every calculation. Stress-test the deal: nightly rate 20% lower, occupancy 15 points lower, costs 10% higher, and a one-month void; say whether it still works. Consider local demand, seasonality, competition, exit options and the worst realistic case. Also include the key "stress_tests" (array of {"scenario": string, "monthly_profit": string, "still_works": boolean}).`,
};

async function complete(system: string, user: string, level: LevelId) {
  const client = new OpenAI();
  const { model, effort } = LEVELS[level];
  const request = (m: string) => client.chat.completions.create({
    model: m,
    reasoning_effort: effort,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  let completion;
  try {
    completion = await request(model);
  } catch (error) {
    // If this account can't use the configured model, fall back rather than fail.
    const status = (error as { status?: number }).status;
    if (model === FALLBACK_MODEL || (status !== 404 && status !== 400)) throw error;
    console.warn(`Model ${model} unavailable (${status}); falling back to ${FALLBACK_MODEL}`);
    completion = await request(FALLBACK_MODEL);
  }
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return JSON.parse(content) as Record<string, unknown>;
}

export const runAnalysis = (deal: string, level: LevelId) =>
  complete(`${BASE_PROMPT}\n\n${LEVEL_PROMPT[level]}`, deal, level);

const RANK_PROMPT = `You are Deal Pro's UK property deal sourcer. You are given Deal Finder search results as JSON (each has an id, type, beds, area, postcode, monthly rent and an estimated nightly rate) plus the user's search filters. Rank them by how good they are as rent-to-rent / serviced accommodation opportunities.

Judge each on: likely monthly profit at 80% occupancy (revenue = 24 nights x nightly rate, minus 15% platform fees, £45 cleaning per 3-night stay, rent and about £150 other costs), break-even occupancy, rent level against the area, demand for short stays in that location, and compliance risk (the London 90-night short-let limit applies to every London property unless planning permission is obtained; HMO and Article 4 where relevant). Treat nightly rates as estimates and say so. Never invent facts about a specific listing.

Return valid JSON with exactly these keys:
summary (plain English, max 60 words, what the best options have in common),
picks (array, best first, of {"id": string, "score": integer 0-100, "verdict": "Strong" | "Potential" | "Weak", "reason": string, "monthly_profit_80": string}),
watch_outs (array of short strings that apply across these results).`;

const RANK_LEVEL: Record<LevelId, string> = {
  quick: "Return only the 5 best picks, with a one-sentence reason each.",
  standard: "Return the 10 best picks, with a two-sentence reason each covering the numbers and the main risk.",
  deep: `Return the 10 best picks. For each, give a thorough reason covering the numbers, local demand, the biggest risk and whether it survives a 20% lower nightly rate. Also add "notes" to each pick (array of short strings: compliance points and what to check with the landlord).`,
};

export const runRank = (payload: string, level: LevelId) => complete(`${RANK_PROMPT}\n\n${RANK_LEVEL[level]}`, payload, level);
