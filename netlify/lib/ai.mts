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
export const WEEKLY_CREDITS: Record<string, number> = { Pro: 60, Max5: 300, Max20: 1200 };

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
  // Scout is a quick, useful first look; Analyst and Expert go much further.
  quick: `Give a fast first look only. Work out the realistic monthly profit, upfront cash and break-even, give the verdict, and name the three most important risks. Keep every list to at most 3 short items. For occupancy_scenarios give only the 80% case. Keep the summary under 50 words.`,
  standard: "Give a full analysis: work through the numbers carefully, cover all material risks and give clear next steps.",
  deep: `Give a thorough, investment-committee-grade analysis. Double-check every calculation. Stress-test the deal: nightly rate 20% lower, occupancy 15 points lower, costs 10% higher, and a one-month void; say whether it still works. Consider local demand, seasonality, competition, exit options and the worst realistic case. Also include the key "stress_tests" (array of {"scenario": string, "monthly_profit": string, "still_works": boolean}).`,
};

const errText = (error: unknown) => {
  const e = error as { status?: number; message?: string };
  return `${e.status ? `${e.status} ` : ""}${String(e.message || error).slice(0, 300)}`;
};
// Errors worth retrying with another model or setup (bad request, unknown model, unsupported feature).
const retryable = (error: unknown) => { const st = (error as { status?: number }).status; return !st || (st >= 400 && st < 500 && st !== 401 && st !== 429); };

// Tries each attempt in turn and throws one error listing every failure.
async function tryEach<T>(label: string, attempts: Array<[string, () => Promise<T>]>): Promise<T> {
  const failures: string[] = [];
  for (const [name, run] of attempts) {
    try { return await run(); } catch (error) {
      failures.push(`${name}: ${errText(error)}`);
      console.warn(`${label} failed with ${name}:`, errText(error));
      if (!retryable(error)) break;
    }
  }
  throw new Error(`${label} failed. ${failures.join(" | ")}`);
}

async function complete(system: string, user: string, level: LevelId) {
  const client = new OpenAI();
  const { model, effort } = LEVELS[level];
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  const withModel = (m: string, reasoning: boolean) => async () => {
    const completion = await client.chat.completions.create({
      model: m, messages, response_format: { type: "json_object" }, ...(reasoning ? { reasoning_effort: effort } : {}),
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    return JSON.parse(content) as Record<string, unknown>;
  };
  return tryEach("AI analysis", [
    [model, withModel(model, true)],
    [FALLBACK_MODEL, withModel(FALLBACK_MODEL, true)],
    [`${FALLBACK_MODEL} (no reasoning setting)`, withModel(FALLBACK_MODEL, false)],
    ["gpt-4.1-mini", withModel("gpt-4.1-mini", false)],
  ]);
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
  quick: "Return only the 3 best picks, with a one-sentence reason each. Give at most 2 watch_outs.",
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

// How hard each level searches. Expert runs many rounds per site from different angles,
// then opens the best listings to confirm they're still available.
const SEARCH_LEVEL: Record<LevelId, { passes: number; perPass: number; context: "low" | "medium" | "high"; effort: Effort; verify: number }> = {
  // Scout: one quick look per site. Analyst: two rounds per site from different angles. Expert: eight rounds plus checks.
  quick: { passes: 1, perPass: 5, context: "low", effort: "low", verify: 0 },
  standard: { passes: 2, perPass: 12, context: "medium", effort: "low", verify: 0 },
  deep: { passes: 8, perPass: 15, context: "high", effort: "medium", verify: 40 },
};

// Each round searches from a different angle so later rounds find listings earlier ones missed.
const ANGLES = [
  "Start with the most relevant current listings.",
  "Now look in nearby neighbourhoods, suburbs and towns within about 5 miles.",
  "Now use different wording: flat, apartment, house, maisonette, 'to let', 'available now', 'long let'.",
  "Now focus on the lower half of the price range.",
  "Now focus on the upper half of the price range.",
  "Now look for the most recently added listings.",
  "Now look for listings that suit serviced accommodation or rent-to-rent: 'company let', 'professional let', 'furnished', 'bills included', 'landlord open to'.",
  "Now try neighbouring postcode districts and any areas you haven't covered yet.",
];
export type Filters = {
  mode?: string; beds?: string | string[]; min?: number | string; max?: number | string; loc?: string;
  priv?: boolean; furn?: string; type?: string;
};

export type Listing = {
  site: string; id: string; title: string; type: string; beds: number | null; area: string; postcode: string;
  price: number; mode: "rent" | "buy"; private: boolean | null; furnished: string; url: string; found: string;
  verified?: "available" | "unavailable" | "unknown";
  details?: { deposit: string; availableFrom: string; highlights: string[] };
};

// Bedrooms can be one size or several (for example studio to 2 beds); "4" means 4 or more.
function bedsText(beds: Filters["beds"]) {
  const list = (Array.isArray(beds) ? beds : beds && beds !== "any" ? [beds] : []).map(String).filter((v) => /^[0-4]$/.test(v));
  if (!list.length) return "";
  const name = (v: string) => (v === "0" ? "studio" : v === "4" ? "4 or more bedrooms" : v === "1" ? "1 bedroom" : `${v} bedrooms`);
  const nums = [...new Set(list)].map(Number).sort((a, b) => a - b);
  const range = nums.length > 1 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  const words = range ? `${name(String(nums[0]))} to ${name(String(nums[nums.length - 1]))}` : nums.map((n) => name(String(n))).join(" or ");
  return `bedrooms: ${words}`;
}

function describe(f: Filters) {
  const buy = f.mode === "buy";
  const parts = [
    buy ? "for sale" : "to rent",
    f.loc?.trim() ? `in or near ${f.loc.trim()}, UK` : "anywhere in the UK",
    bedsText(f.beds),
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

async function webJson(prompt: string, domains: string[], level: LevelId, context: "low" | "medium" | "high", effort: Effort) {
  const client = new OpenAI();
  // With no domains the search is open to the whole web (used for due diligence research).
  const site = domains.length ? `Only use ${domains.join(" or ")} (for example search "site:${domains[0]} ...").` : "";
  // The most capable setup first, then simpler ones for accounts or gateways that don't support every option.
  const call = (model: string, opts: { tool: "web_search" | "web_search_preview"; filters: boolean; json: boolean; reasoning: boolean }) => () =>
    client.responses.create({
      model,
      ...(opts.reasoning ? { reasoning: { effort } } : {}),
      tools: [opts.tool === "web_search"
        ? { type: "web_search", search_context_size: context, ...(opts.filters ? { ...(domains.length ? { filters: { allowed_domains: domains } } : {}), user_location: { type: "approximate" as const, country: "GB" } } : {}) }
        : { type: "web_search_preview", search_context_size: context }],
      ...(opts.filters ? { include: ["web_search_call.action.sources" as const] } : {}),
      ...(opts.json ? { text: { format: { type: "json_object" as const } } } : {}),
      input: opts.filters ? prompt : `${prompt}\n${site}\nReply with the JSON only.`,
    });
  const response = await tryEach("Web search", [
    [LEVELS[level].model, call(LEVELS[level].model, { tool: "web_search", filters: true, json: true, reasoning: true })],
    [FALLBACK_MODEL, call(FALLBACK_MODEL, { tool: "web_search", filters: true, json: true, reasoning: true })],
    [`${FALLBACK_MODEL} (plain)`, call(FALLBACK_MODEL, { tool: "web_search", filters: false, json: false, reasoning: false })],
    ["gpt-4.1-mini (preview search)", call("gpt-4.1-mini", { tool: "web_search_preview", filters: false, json: false, reasoning: false })],
  ]);
  // URLs the web search really returned.
  const seen = new Set<string>();
  for (const item of response.output as Array<Record<string, any>>) {
    if (item.type === "web_search_call") for (const s of item.action?.sources || []) if (s?.url) seen.add(normalise(s.url));
    if (item.type === "message") for (const c of item.content || []) for (const a of c.annotations || []) if (a?.url) seen.add(normalise(a.url));
  }
  let parsed: Record<string, any> = {};
  try { parsed = JSON.parse(response.output_text || "{}"); } catch {
    const m = (response.output_text || "").match(/\{[\s\S]*\}/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
  }
  return { parsed, seen };
}

async function searchSite(site: string, f: Filters, level: LevelId, pass: number, exclude: string[]): Promise<Listing[]> {
  const conf = SITES[site];
  const lv = SEARCH_LEVEL[level];
  const buy = f.mode === "buy";
  const skip = exclude.length ? `\nYou've already found these, so don't return them again:\n${exclude.slice(-80).join("\n")}` : "";
  const prompt = `Search ${conf.domains[0]} (${conf.what}) for listings that are currently available: ${describe(f)}.
${ANGLES[pass % ANGLES.length]} ${level === "quick" ? `Do one quick search and return up to ${lv.perPass} matching individual listings.` : `Search several times with different wording until you have up to ${lv.perPass} matching individual listings.`} Only use individual listing pages, never search-results or category pages.${skip}
Return JSON: {"listings": [{"title": string, "type": string (e.g. "2 bed flat", "Office"), "beds": number or null (0 for studio), "area": string (street/area and town), "postcode": string (postcode district like "M1" or "SE1", "" if unknown), "price": number (${buy ? "asking price in GBP" : "monthly rent in GBP; convert weekly rents x 52 / 12"}), "url": string (the listing page URL exactly as found), "furnished": "Furnished" | "Unfurnished" | "Part furnished" | "Not stated", "private_landlord": true | false | null}]}.
Only include listings you actually found in the search results. Never invent a listing, price or URL. If you find none, return {"listings": []}.`;
  const { parsed, seen } = await webJson(prompt, conf.domains, level, lv.context, lv.effort);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const out: Listing[] = [];
  for (const x of (parsed.listings || []) as Array<Record<string, unknown>>) {
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
  return out;
}

// Expert only: open listing pages to confirm they're still available and fill in details.
async function verifyBatch(batch: Listing[], level: LevelId) {
  const domains = [...new Set(batch.flatMap((l) => SITES[l.site].domains))];
  const prompt = `Open each of these property listing pages and check them:
${batch.map((l, i) => `${i + 1}. ${l.url}`).join("\n")}
For each, confirm whether it is still available (not let agreed, under offer, sold or removed), and read the details.
Return JSON: {"checks": [{"url": string (exactly as given), "available": true | false | null, "price": number or null (${batch[0].mode === "buy" ? "asking price" : "monthly rent"} in GBP), "beds": number or null, "deposit": string, "available_from": string, "furnished": string, "private_landlord": true | false | null, "highlights": [short strings: key features, restrictions, bills, pets, DSS, short lets allowed or not]}]}.
Only report what the pages actually say. Use null or "" when a detail isn't shown.`;
  const { parsed } = await webJson(prompt, domains, level, "high", "medium");
  const byUrl = new Map(batch.map((l) => [normalise(l.url), l]));
  for (const c of (parsed.checks || []) as Array<Record<string, any>>) {
    const l = byUrl.get(normalise(String(c.url || "")));
    if (!l) continue;
    l.verified = c.available === false ? "unavailable" : c.available === true ? "available" : "unknown";
    const price = Math.round(Number(c.price));
    if (Number.isFinite(price) && price > 0) l.price = price;
    if (Number.isFinite(Number(c.beds)) && c.beds !== null) l.beds = Math.round(Number(c.beds));
    if (typeof c.private_landlord === "boolean") l.private = c.private_landlord;
    if (c.furnished) l.furnished = String(c.furnished).slice(0, 30);
    l.details = {
      deposit: String(c.deposit || "").slice(0, 60),
      availableFrom: String(c.available_from || "").slice(0, 60),
      highlights: Array.isArray(c.highlights) ? c.highlights.slice(0, 8).map((h: unknown) => String(h).slice(0, 120)) : [],
    };
  }
}

// A search that can be paused and resumed, so Expert can run far longer than one
// 15-minute background function: each run works until its deadline, saves this state,
// and the runner starts another run to continue.
export type SearchState = {
  filters: Filters; sites: string[]; phase: "search" | "verify" | "rank" | "done";
  round: number; verifyAt: number; listings: Listing[];
  sites_status: Record<string, { status: string; found: number; round?: number; rounds?: number; error?: string; detail?: string }>;
  ranking?: Record<string, unknown> | null; startedAt: string;
};

export function newSearch(input: string, level: LevelId): SearchState {
  const { filters = {}, sites = [] } = JSON.parse(input) as { filters?: Filters; sites?: string[] };
  const wanted = sites.filter((s) => s in SITES);
  return {
    filters, sites: wanted, phase: "search", round: 0, verifyAt: 0, listings: [], startedAt: new Date().toISOString(),
    sites_status: Object.fromEntries(wanted.map((s) => [s, { status: "searching", found: 0, round: 0, rounds: SEARCH_LEVEL[level].passes }])),
  };
}

export const searchProgress = (st: SearchState) => ({ phase: st.phase, sites: st.sites_status, found: st.listings.length, verified: st.verifyAt });

export async function stepSearch(st: SearchState, level: LevelId, deadline: number, save: (st: SearchState) => Promise<void>) {
  const lv = SEARCH_LEVEL[level];
  const min = Number(st.filters.min) || 0, max = Number(st.filters.max) || Infinity;
  const known = () => new Set(st.listings.map((l) => l.id));
  const timeLeft = () => deadline - Date.now();

  // Rounds: every site is searched in parallel, each round from a new angle.
  while (st.phase === "search") {
    if (st.round >= lv.passes) { st.phase = lv.verify ? "verify" : "rank"; break; }
    if (timeLeft() < 4 * 60_000) return st;
    const round = st.round;
    await Promise.all(st.sites.map(async (site) => {
      if (st.sites_status[site]?.status === "error") return;
      try {
        const mine = st.listings.filter((l) => l.site === site).map((l) => l.url);
        const found = (await searchSite(site, st.filters, level, round, mine)).filter((l) => l.price >= min && l.price <= max);
        const have = known();
        for (const l of found) if (!have.has(l.id) && st.listings.length < 500) { st.listings.push(l); have.add(l.id); }
        const count = st.listings.filter((l) => l.site === site).length;
        st.sites_status[site] = { status: round + 1 >= lv.passes ? "done" : "searching", found: count, round: round + 1, rounds: lv.passes };
      } catch (error) {
        console.error(`Search failed for ${site} (round ${round + 1})`, error);
        const count = st.listings.filter((l) => l.site === site).length;
        // A failed first round means the site can't be searched; later failures just end that site early.
        st.sites_status[site] = round === 0 && !count
          ? { status: "error", found: 0, error: "Couldn't search this site", detail: errText(error) }
          : { status: "done", found: count, round: round + 1, rounds: lv.passes };
      }
      await save(st).catch(() => {});
    }));
    st.round += 1;
    await save(st);
  }
  if (st.sites.length && st.sites.every((s) => st.sites_status[s]?.status === "error")) {
    throw new Error(`All site searches failed. ${st.sites_status[st.sites[0]]?.detail || ""}`);
  }

  // Verify: open the most promising listings (cheapest per bedroom first) in batches.
  if (st.phase === "verify") {
    const order = [...st.listings].sort((a, b) => a.price / Math.max(1, a.beds ?? 1) - b.price / Math.max(1, b.beds ?? 1));
    const targets = order.slice(0, lv.verify);
    while (st.verifyAt < targets.length) {
      if (timeLeft() < 4 * 60_000) return st;
      const batch = targets.slice(st.verifyAt, st.verifyAt + 5);
      try { await verifyBatch(batch, level); } catch (error) { console.error("Verify failed", error); }
      st.verifyAt += batch.length;
      await save(st);
    }
    // Drop listings the pages say are gone.
    st.listings = st.listings.filter((l) => l.verified !== "unavailable");
    st.phase = "rank";
    await save(st);
  }

  if (st.phase === "rank") {
    if (timeLeft() < 3 * 60_000) return st;
    if (st.listings.length) {
      try {
        st.ranking = await runRank(JSON.stringify({
          filters: st.filters,
          listings: st.listings.slice(0, level === "quick" ? 40 : 120).map((l, i) => ({
            id: String(i), site: SITES[l.site].label, type: l.type, beds: l.beds, area: l.area, postcode: l.postcode,
            [l.mode === "buy" ? "asking_price" : "rent_pcm"]: l.price,
            ...(l.details ? { checked_details: l.details, still_available: l.verified } : {}),
          })),
        }), level);
      } catch (error) { console.error("Ranking failed", error); st.ranking = null; }
    }
    st.phase = "done";
    await save(st);
  }
  return st;
}

// ---------- due diligence research ----------
// Researches each due diligence check for a deal on the public web and returns a draft finding
// with the sources it used. Only sources the web search really returned are kept, so every link
// can be opened and checked.
export type DDCheck = { k: string; t: string; d: string };
export type DDFinding = { k: string; status: "partly" | "issue" | "none"; finding: string; sources: Array<{ title: string; url: string }> };

const DD_PROMPT = `You are Deal Pro's UK property due diligence researcher. Research the deal below on the public web (council websites, GOV.UK, the Valuation Office Agency, the EPC register, planning portals, transport operators, Land Registry guidance, comparable short-let and rental listings).
For each check, report what you actually found for this specific property and area, with figures, dates and names where the sources give them. Never invent facts; if the sources don't answer a check, say exactly what the user needs to obtain and from whom.
Status: "issue" if you found a problem or a risk that needs resolving, "partly" if you found useful evidence but the user still needs to confirm something, "none" if you found nothing relevant. Never mark a check as verified: only the user can do that.`;
const DD_FORMAT = `Return JSON: {"findings": [{"k": string (the check key), "status": "partly" | "issue" | "none", "finding": string (max 90 words, plain English), "sources": [{"title": string, "url": string}]}]}. Include every check key given, once.`;
const DD_LEVEL: Record<LevelId, { context: "low" | "medium" | "high"; note: string }> = {
  quick: { context: "low", note: "Give a quick first pass: one short, useful fact for each check (max 40 words) and at most one source each." },
  standard: { context: "medium", note: "Research each check properly and cite the most relevant sources." },
  deep: { context: "high", note: "Research exhaustively: search several sources, cross-check figures, quote current fees, dates and scheme boundaries, and cite every source you rely on." },
};

function keepSources(list: unknown, seen: Set<string>) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is { title?: unknown; url?: unknown } => !!x && typeof x === "object")
    .map((x) => ({ title: String(x.title || "").slice(0, 160), url: String(x.url || "") }))
    .filter((x) => /^https?:\/\//.test(x.url) && (seen.size === 0 ? false : seen.has(normalise(x.url))))
    .slice(0, 6);
}

export async function runResearch(input: string, level: LevelId) {
  const { deal, checks } = JSON.parse(input) as { deal: string; checks: DDCheck[] };
  const lv = DD_LEVEL[level];
  const effort = LEVELS[level].effort;
  const list = (cs: DDCheck[]) => cs.map((c) => `- ${c.k}: ${c.t}. ${c.d}`).join("\n");
  const ask = (cs: DDCheck[]) => webJson(`${DD_PROMPT}\n${lv.note}\n\nDeal:\n${deal}\n\nChecks:\n${list(cs)}\n\n${DD_FORMAT}`, [], level, lv.context, effort);
  // Expert researches every check separately, in parallel, so each gets a full search.
  const parts = level === "deep"
    ? await Promise.all(checks.map((c) => ask([c]).catch((error) => { console.warn("Research failed for", c.k, errText(error)); return null; })))
    : [await ask(checks)];
  if (parts.every((p) => !p)) throw new Error("Due diligence research failed for every check");
  const byKey = new Map<string, DDFinding>();
  for (const part of parts) {
    if (!part) continue;
    const found = Array.isArray(part.parsed.findings) ? part.parsed.findings : [];
    for (const f of found as Array<Record<string, unknown>>) {
      const k = String(f?.k || "");
      if (!checks.some((c) => c.k === k) || byKey.has(k)) continue;
      // Only the user can mark a check verified, so the AI's "verified" becomes "partly".
      const status = f.status === "issue" ? "issue" : f.status === "partly" || f.status === "verified" ? "partly" : "none";
      byKey.set(k, { k, status, finding: String(f.finding || "").slice(0, 900), sources: keepSources(f.sources, part.seen) });
    }
  }
  return {
    findings: checks.map((c) => byKey.get(c.k) || { k: c.k, status: "none" as const, finding: "The research didn't find public information for this check. Obtain the evidence directly and add it below.", sources: [] }),
    researchedAt: new Date().toISOString(),
  };
}
