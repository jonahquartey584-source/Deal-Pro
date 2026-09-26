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

const RANK_PROMPT = `You are Deal Pro's UK property deal sourcer. You are given Deal Finder search results as JSON (each has an id, site, type, beds, area, postcode and either a monthly rent or an asking price) plus the user's search filters. Rank them by how good they are as property deals for the user's strategy: rent-to-rent / serviced accommodation for rentals; buy-to-let, HMO, BRRR or serviced accommodation for purchases. Estimate a realistic nightly rate or rent for the location where needed and say it is an estimate.

Judge each on: for rentals, likely monthly profit at 80% occupancy (revenue = 24 nights x nightly rate, minus 15% platform fees, £45 cleaning per 3-night stay, rent and about £150 other costs), break-even occupancy, for purchases, gross yield and cash flow; price or rent level against the area, demand for short stays in that location, and compliance risk (the London 90-night short-let limit applies to every London property unless planning permission is obtained; HMO and Article 4 where relevant). Treat nightly rates as estimates and say so. Never invent facts about a specific listing. The id is only for matching your picks to the results: never mention ids anywhere in your text. When you compare listings, name them by type and street or area (for example "the 1 bed flat on Adam & Eve Court").

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

// ---------- live Deal Finder search ----------
// Each ticked site is searched separately with OpenAI's web search, restricted to that
// site's domain. Only listing URLs that the search actually returned are kept, so the AI
// can't invent listings.
export const SITES: Record<string, { label: string; domains: string[]; what: string }> = {
  OpenRent: { label: "OpenRent", domains: ["openrent.co.uk"], what: "property to rent, mostly from private landlords" },
  SpareRoom: { label: "SpareRoom", domains: ["spareroom.co.uk"], what: "whole properties and rooms to rent" },
  Gumtree: { label: "Gumtree", domains: ["gumtree.com"], what: "property to rent or buy" },
  Rightmove: { label: "Rightmove", domains: ["rightmove.co.uk"], what: "residential property to rent or buy" },
  Zoopla: { label: "Zoopla", domains: ["zoopla.co.uk"], what: "residential property to rent or buy" },
  Facebook: { label: "Facebook Marketplace", domains: ["facebook.com"], what: "Facebook Marketplace property listings" },
  RightmoveCommercial: { label: "Rightmove Commercial", domains: ["rightmove.co.uk"], what: "commercial property to let or buy (rightmove.co.uk/commercial-property)" },
  Realla: { label: "Realla", domains: ["realla.co"], what: "commercial property to let or buy" },
  NovaLoca: { label: "NovaLoca", domains: ["novaloca.com"], what: "commercial property, offices and shops to let or buy" },
  LoopNet: { label: "LoopNet", domains: ["loopnet.co.uk", "loopnet.com"], what: "UK commercial property to let or buy" },
};

const SEARCH_LEVEL: Record<LevelId, { perSite: number; context: "low" | "medium" | "high"; effort: Effort }> = {
  quick: { perSite: 8, context: "low", effort: "low" },
  standard: { perSite: 15, context: "medium", effort: "low" },
  deep: { perSite: 25, context: "high", effort: "medium" },
};

export type Filters = {
  mode?: string; beds?: string; min?: number | string; max?: number | string; loc?: string;
  priv?: boolean; furn?: string; type?: string;
};

export type Listing = {
  site: string; id: string; title: string; type: string; beds: number | null; area: string; postcode: string;
  price: number; mode: "rent" | "buy"; private: boolean | null; furnished: string; url: string; found: string;
};

function describe(f: Filters) {
  const buy = f.mode === "buy";
  const parts = [
    buy ? "for sale" : "to rent",
    f.loc?.trim() ? `in or near ${f.loc.trim()}, UK` : "anywhere in the UK",
    f.beds && f.beds !== "any" ? (f.beds === "0" ? "studios" : f.beds === "4" ? "4 or more bedrooms" : `${f.beds} bedrooms`) : "",
    f.type && f.type !== "any" ? `property type: ${f.type}` : "",
    f.min !== "" && f.min != null ? `from £${f.min}${buy ? "" : " per month"}` : "",
    f.max !== "" && f.max != null ? `up to £${f.max}${buy ? "" : " per month"}` : "",
    f.furn && f.furn !== "any" ? f.furn : "",
    f.priv ? "private landlords only (no agents)" : "",
  ];
  return parts.filter(Boolean).join(", ");
}

const hostMatches = (url: string, domains: string[]) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
};
const normalise = (url: string) => { try { const u = new URL(url); u.hash = ""; return u.toString().replace(/\/$/, ""); } catch { return url; } };

async function searchSite(site: string, f: Filters, level: LevelId): Promise<Listing[]> {
  const conf = SITES[site];
  const lv = SEARCH_LEVEL[level];
  const client = new OpenAI();
  const buy = f.mode === "buy";
  const prompt = `Search ${conf.domains[0]} (${conf.what}) for listings that are currently available: ${describe(f)}.
Search several times with different wording and nearby areas until you have up to ${lv.perSite} matching individual listings. Only use individual listing pages, never search-results or category pages.
Return JSON: {"listings": [{"title": string, "type": string (e.g. "2 bed flat", "Office"), "beds": number or null (0 for studio), "area": string (street/area and town), "postcode": string (postcode district like "M1" or "SE1", "" if unknown), "price": number (${buy ? "asking price in GBP" : "monthly rent in GBP; convert weekly rents x 52 / 12"}), "url": string (the listing page URL exactly as found), "furnished": "Furnished" | "Unfurnished" | "Part furnished" | "Not stated", "private_landlord": true | false | null}]}.
Only include listings you actually found in the search results. Never invent a listing, price or URL. If you find none, return {"listings": []}.`;
  const run = (model: string) => client.responses.create({
    model,
    reasoning: { effort: lv.effort },
    tools: [{ type: "web_search", search_context_size: lv.context, filters: { allowed_domains: conf.domains }, user_location: { type: "approximate", country: "GB" } }],
    include: ["web_search_call.action.sources"],
    text: { format: { type: "json_object" } },
    input: prompt,
  });
  let response;
  try {
    response = await run(LEVELS[level].model);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 404 && status !== 400) throw error;
    response = await run(FALLBACK_MODEL);
  }

  // URLs the web search really returned for this site.
  const seen = new Set<string>();
  for (const item of response.output as Array<Record<string, any>>) {
    if (item.type === "web_search_call") for (const s of item.action?.sources || []) if (s?.url) seen.add(normalise(s.url));
    if (item.type === "message") for (const c of item.content || []) for (const a of c.annotations || []) if (a?.url) seen.add(normalise(a.url));
  }
  let parsed: { listings?: Array<Record<string, unknown>> } = {};
  try { parsed = JSON.parse(response.output_text || "{}"); } catch {
    const m = (response.output_text || "").match(/\{[\s\S]*\}/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const out: Listing[] = [];
  for (const x of parsed.listings || []) {
    const url = String(x.url || "");
    if (!/^https:\/\//.test(url) || !hostMatches(url, conf.domains)) continue;
    // Keep only pages the search returned (when the API reports its sources).
    if (seen.size && !seen.has(normalise(url))) continue;
    const price = Math.round(Number(x.price));
    if (!Number.isFinite(price) || price <= 0) continue;
    const beds = x.beds === null || x.beds === undefined || x.beds === "" ? null : Math.max(0, Math.round(Number(x.beds)));
    out.push({
      site, id: normalise(url), url,
      title: String(x.title || "").slice(0, 140),
      type: String(x.type || (beds === 0 ? "Studio" : beds ? `${beds} bed property` : "Property")).slice(0, 60),
      beds: Number.isFinite(beds as number) ? beds : null,
      area: String(x.area || "").slice(0, 120),
      postcode: String(x.postcode || "").toUpperCase().slice(0, 8),
      price, mode: buy ? "buy" : "rent",
      private: typeof x.private_landlord === "boolean" ? x.private_landlord : null,
      furnished: ["Furnished", "Unfurnished", "Part furnished"].includes(String(x.furnished)) ? String(x.furnished) : "Not stated",
      found: today,
    });
  }
  return out.slice(0, lv.perSite);
}

// Searches every requested site at once, reporting progress per site as each finishes.
export async function runSearch(input: string, level: LevelId, progress: (p: Record<string, unknown>) => Promise<void>) {
  const { filters = {}, sites = [] } = JSON.parse(input) as { filters?: Filters; sites?: string[] };
  const wanted = sites.filter((s) => s in SITES);
  const state: Record<string, { status: string; found?: number; error?: string }> = Object.fromEntries(wanted.map((s) => [s, { status: "searching" }]));
  await progress(state);
  const min = Number(filters.min) || 0, max = Number(filters.max) || Infinity;
  const results = await Promise.all(wanted.map(async (site) => {
    try {
      const found = (await searchSite(site, filters, level)).filter((l) => l.price >= min && l.price <= max);
      state[site] = { status: "done", found: found.length };
      return found;
    } catch (error) {
      console.error(`Search failed for ${site}`, error);
      state[site] = { status: "error", found: 0, error: "Couldn't search this site" };
      return [];
    } finally {
      await progress({ ...state }).catch(() => {});
    }
  }));
  // Merge and drop duplicates (the same listing can appear twice).
  const byUrl = new Map<string, Listing>();
  for (const l of results.flat()) if (!byUrl.has(l.id)) byUrl.set(l.id, l);
  const listings = [...byUrl.values()];
  if (wanted.length && Object.values(state).every((s) => s.status === "error")) throw new Error("All site searches failed");

  let ranking: Record<string, unknown> | null = null;
  if (listings.length) {
    try {
      ranking = await runRank(JSON.stringify({
        filters,
        listings: listings.map((l, i) => ({ id: String(i), site: SITES[l.site].label, type: l.type, beds: l.beds, area: l.area, postcode: l.postcode, [l.mode === "buy" ? "asking_price" : "rent_pcm"]: l.price })),
      }), level);
    } catch (error) { console.error("Ranking failed", error); }
  }
  return { listings, sites: state, ranking };
}
