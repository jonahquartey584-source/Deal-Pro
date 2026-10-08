import OpenAI from "openai";
import { getStore } from "@netlify/blobs";

export const ADMIN_EMAIL = "jonahquartey584@gmail.com";
export const FREE_ANALYSES = 1;
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
export const WEEKLY_CREDITS: Record<string, number> = { Lite: 15, Pro: 60, Max5: 300, Max20: 1200 };
// Plans limited to Scout. Analyst and Expert start at Premium.
export const SCOUT_ONLY_PLANS = new Set(["Lite"]);

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

const BASE_PROMPT = `You are Deal Pro's UK property deal analyst for rent-to-rent (R2R), rent-to-serviced-accommodation (R2SA), buy-to-let (BTL), HMO, BRRR, lease option, flip and commercial deals.

Act as a sceptical, independent underwriter whose job is to protect the user's money, not to sell the deal. Adverts, agents and deal sourcers routinely overstate rents, nightly rates, occupancy and end values and leave costs out. Treat every figure the user gives you as a claim to test, not a fact. It is far better to call a marginal deal Weak than to let the user lose money on it.

Figures and assumptions:
- Use the figures given where they are plausible. If a claimed figure is above what is normal for the area and property (for example a nightly rate, room rent, occupancy or end value), say so, use a more conservative figure for the realistic case, and explain why.
- When you must assume something, choose the conservative end of the normal range, list it in "assumptions" and label the number "(est.)". Never invent facts about the specific property.
- If market evidence gathered from the web is provided below the deal, base your figures on it and say what it shows.
- Use UK conventions, pounds sterling, current UK tax rules and today's typical rates.

Model every cost, not just rent:
- R2SA and serviced accommodation: the realistic case uses realistic occupancy for the area (about 55-65% for most UK locations unless evidence supports more; 80% is an optimistic case, not the base case). Include platform and payment fees (about 15%), cleaning and laundry per stay (£40-£60, assume a 2.5-3 night average stay), consumables (£40-£80/month), utilities, broadband and TV licence if not included (£150-£300/month for a 1-2 bed), council tax (second-home premium in many councils) or business rates, specialist short-let insurance (£30-£60/month), channel manager and pricing software (£20-£50/month), maintenance and replacements (about 5% of revenue), and management at 15-20% if the user won't run it themselves. Upfront cash includes deposit, first month's rent, furnishing and set-up (typically £3,000-£6,000 for a 1-2 bed), photography, compliance and any sourcing fee.
- R2R and HMO: realistic room rents for the area, bills per room (£80-£120/month), voids of at least one month a year, maintenance, licensing costs and management.
- Purchases: purchase tax for the property's nation (stamp duty with the surcharge for additional properties in England and Northern Ireland, LBTT and the Additional Dwelling Supplement in Scotland, LTT higher rates in Wales), legal and survey fees, current buy-to-let mortgage rates (assume 5.5-6% interest-only unless given), letting and management fees (10-15%), maintenance (about 10% of rent), voids (one month a year), insurance and safety certificates.
- Flips and BRRR: a refurbishment contingency of at least 10-15%, finance and holding costs for the full timeline, selling costs, and an end value from genuine comparable sales, not asking prices.
Double-check the arithmetic. monthly_profit must be the realistic case and must agree with your scenarios.

Score strictly with this rubric:
- 80-100 "Strong": clearly profitable in the realistic case with a healthy margin (for example at least £400-£500 a month per unit for R2SA or R2R, 12%+ return on cash for purchases, 20%+ margin for flips), survives a sensible stress test and has no unresolved legal or compliance blocker. This should be rare.
- 60-79 "Potential": works in the realistic case but with thin margins, notable risks or things still to confirm.
- 35-59 "Weak": marginal, relies on optimistic assumptions, or has a serious risk.
- 0-34 "Weak": loses money in the realistic case or has a blocker (for example no consent to sublet, or a plan that depends on London short stays beyond the 90-night limit with no corporate or mid-term letting to fill the rest of the year).
- Short-let deals needing more than about 65% occupancy to break even are Weak. Use "Insufficient information" only when the rent or price is unknown, and still give ranges where you can.

The London 90-night rule: in Greater London, letting a home as temporary sleeping accommodation for stays of fewer than 90 consecutive nights is limited to 90 nights a year without planning permission. It counts nights, not guests: stays of 90 or more consecutive nights (corporate lets, contractor, relocation, insurance or other mid-term lets) don't count towards it, whoever the guest is, while short stays count even when a company books them. So never treat the rule as a blocker by default for London R2SA or serviced accommodation. Model how the operator will fill the year: if the user says they do corporate or mid-term lets, or the details suggest it, model a mix of up to 90 short-stay nights plus 90+ night lets for the rest, pricing the long stays at a realistic furnished, bills-included monthly rate for the area (well below nightly-rate revenue) with a void between placements; if the plan relies on short stays alone, show the capped 90-night case. Say which model you used and what it depends on.

Analyse every deal for its exact location. Work out the neighbourhood, town, postcode district, council and nation, and base the rent, nightly rate, occupancy, seasonality, running costs and resale or refinance values on that area, using the local research provided below the deal. Name the area and source of each local figure in "assumptions". Take account of what drives demand there (universities, hospitals, employers, tourism, events, transport) and the council's own rules (licensing, Article 4, council tax premiums, short-let controls). If the location is unclear, say so, ask for it in "missing_information", and keep figures conservative.

Deals can be anywhere in the UK. Never use London figures outside London, and apply the rules of its nation:
- England and Northern Ireland: Stamp Duty Land Tax, including the surcharge for additional properties.
- Scotland: Land and Buildings Transaction Tax with the Additional Dwelling Supplement instead of stamp duty; short-term lets need a licence from the council, and some areas (for example Edinburgh) are short-term let control areas needing planning permission; tenancies are private residential tenancies.
- Wales: Land Transaction Tax with the higher rates for additional properties; holiday lets must be available and actually let for enough nights a year to pay business rates instead of council tax, and councils can charge council tax premiums on second homes; check any visitor levy.
Check current rates and thresholds for the nation rather than assuming England's.

Always flag compliance: the London 90-night rule where relevant (as above), HMO licensing and Article 4 areas, planning use class, the lease or mortgage permitting subletting or short lets, written landlord consent, insurance, fire safety and deposit protection. Tell the user to verify these with qualified professionals.

Return valid JSON with these keys:
verdict (one of "Strong", "Potential", "Weak", "Insufficient information"),
summary (plain English, max 80 words, including the single biggest reason for the verdict),
score (integer 0-100, using the rubric),
monthly_profit (string, the realistic case),
upfront_cash (string),
break_even (string, e.g. occupancy or rent needed to break even),
occupancy_scenarios (array of {"occupancy": string, "monthly_profit": string}: the realistic occupancy, 80% and 100%; empty if not a short-let deal),
red_flags (array of short strings: claims that look inflated, missing costs, anything that could make this deal lose money; empty if none),
local_context ({"area": string (neighbourhood, town, postcode district), "council": string, "demand": string (max 40 words: who rents here and why), "benchmarks": [{"label": string, "value": string}] (the local figures you used), "rules": [short strings: the council and nation rules that apply]}),
assumptions (array of short strings),
risks (array of short strings),
missing_information (array of short strings),
next_actions (array of short strings).`;

const LEVEL_PROMPT: Record<LevelId, string> = {
  // Scout is a quick, useful first look; Analyst and Expert go much further.
  quick: `Give a fast first look only. Work out the realistic monthly profit, upfront cash and break-even, give the verdict, and name the three most important risks. Keep every list to at most 3 short items. For occupancy_scenarios give only the realistic case. Give at most 3 red_flags. Keep the summary under 50 words.`,
  standard: "Give a full analysis: work through the numbers carefully, cover all material risks and give clear next steps.",
  deep: `Give a thorough, investment-committee-grade analysis. Double-check every calculation. Stress-test the deal: nightly rate 20% lower, occupancy 15 points lower, costs 10% higher, and a one-month void; say whether it still works. Consider local demand, seasonality, competition, exit options and the worst realistic case. Also include the key "stress_tests" (array of {"scenario": string, "monthly_profit": string, "still_works": boolean}).`,
};

// Includes the network reason behind a "Connection error" (for example ECONNRESET or a DNS failure).
const errText = (error: unknown) => {
  const e = error as { status?: number; message?: string; cause?: { code?: string; message?: string; cause?: { code?: string } } };
  const cause = e.cause ? ` (${[e.cause.code || e.cause.cause?.code, e.cause.message].filter(Boolean).join(": ").slice(0, 160)})` : "";
  return `${e.status ? `${e.status} ` : ""}${String(e.message || error).slice(0, 300)}${cause}`;
};
// No HTTP status means the request never got an answer: a network problem, not the request itself.
const isConnectionError = (error: unknown) => !(error as { status?: number }).status;
// One OpenAI client with generous retries and a timeout, shared by every AI call.
let openaiClient: OpenAI | null = null;
// Netlify's AI Gateway fills in OPENAI_API_KEY and OPENAI_BASE_URL when no key of our own is set, and bills the
// calls to Netlify credits. Refuse to run on it: only an OPENAI_API_KEY added by hand in Netlify is used, so
// the usage is billed to the OpenAI account instead.
export const usingNetlifyGateway = () => {
  const base = process.env.OPENAI_BASE_URL;
  if (!base) return false;
  try { return !/(^|\.)openai\.com$/i.test(new URL(base).hostname); } catch { return true; }
};
export const ai = () => {
  if (usingNetlifyGateway()) throw new Error("OPENAI_API_KEY is not set to your own OpenAI key, so Netlify's AI Gateway would be used and billed to Netlify credits. Add your own key in the Netlify environment variables.");
  return (openaiClient ||= new OpenAI({ maxRetries: 3, timeout: 180_000 }));
};
// Errors worth retrying with another model or setup (bad request, unknown model, unsupported feature).
const retryable = (error: unknown) => { const st = (error as { status?: number }).status; return !st || (st >= 400 && st < 500 && st !== 401 && st !== 429); };

// Tries each attempt in turn. If every one failed only because OpenAI couldn't be reached,
// waits and goes round again (a brief outage or network blip), then throws one error listing
// every failure.
async function tryEach<T>(label: string, attempts: Array<[string, () => Promise<T>]>): Promise<T> {
  const failures: string[] = [];
  for (const wait of [0, 10_000, 30_000]) {
    if (wait) { console.warn(`${label}: OpenAI unreachable, trying again in ${wait / 1000}s`); await new Promise((r) => setTimeout(r, wait)); }
    let networkOnly = true;
    for (const [name, run] of attempts) {
      try { return await run(); } catch (error) {
        failures.push(`${name}: ${errText(error)}`);
        console.warn(`${label} failed with ${name}:`, errText(error));
        if (!isConnectionError(error)) networkOnly = false;
        if (!retryable(error)) break;
      }
    }
    if (!networkOnly) break;
  }
  throw new Error(`${label} failed. ${failures.slice(-8).join(" | ")}`);
}

async function complete(system: string, user: string, level: LevelId) {
  const client = ai();
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

// Strategies a user can ask the analyser to use. Ids must match STRATEGIES in index.html.
export const STRATEGIES: Record<string, { name: string; prompt: string }> = {
  R2SA: { name: "Rent-to-serviced accommodation (R2SA)", prompt: "Model it as rent-to-serviced accommodation: nightly rate, occupancy at 60%, 80% and 100%, platform fees, cleaning, rent, bills and running costs, break-even occupancy and upfront cash (deposit, first month, furnishing, set-up). Check landlord consent for short lets. In London, apply the 90-night rule correctly: it only limits stays of under 90 consecutive nights, so model corporate or mid-term lets of 90+ nights for the rest of the year where the operator uses them." },
  R2R: { name: "Rent-to-rent (R2R, let by the room or as an HMO)", prompt: "Model it as rent-to-rent let by the room: realistic room rents for the area, rent paid to the landlord, bills, voids (assume one month a year if not given), management and maintenance, monthly profit per room and in total, and upfront cash. Check HMO licensing, Article 4, a company let and written consent to sublet." },
  BTL: { name: "Buy-to-let (BTL)", prompt: "Model it as a buy-to-let purchase: purchase price, 25% deposit unless given, purchase tax at current rates for the nation (stamp duty with the surcharge for additional properties in England and Northern Ireland, LBTT with the Additional Dwelling Supplement in Scotland, LTT higher rates in Wales), legal and survey costs, mortgage at an assumed 5.5% interest-only rate unless given, realistic market rent, letting and management fees, maintenance, insurance and voids. Give gross and net yield, monthly cash flow, return on cash invested and whether it passes a lender's 125% interest cover stress test." },
  HMO: { name: "HMO (buy and let by the room)", prompt: "Model it as an owned HMO: purchase and conversion costs, stamp duty, room count and realistic room rents, bills, management, voids and maintenance, mortgage (HMO rates, assume 6% interest-only unless given), net yield, monthly cash flow and return on cash. Check mandatory and additional HMO licensing, Article 4 and planning use class (C3 to C4 or sui generis)." },
  BRRR: { name: "BRRR (buy, refurbish, refinance, rent)", prompt: "Model it as BRRR: purchase price, stamp duty, refurbishment, bridging or purchase finance costs, holding costs and timeline, end value after works (say it is an estimate and what it is based on), refinance at 75% loan-to-value, money left in the deal after refinance, monthly cash flow on the new mortgage and return on money left in. Flag if the end value is optimistic." },
  Flip: { name: "Flip (buy, refurbish, sell)", prompt: "Model it as a flip: purchase price, stamp duty, legal fees, refurbishment with a 10% contingency, finance and holding costs over the project, selling costs (agent and legal), realistic resale value from comparable sales (say it is an estimate), profit before tax, profit as a percentage of the resale value (aim for at least 15-20%) and return on cash invested. Give the maximum purchase price that still hits a 20% margin." },
  LeaseOption: { name: "Lease option (purchase lease option)", prompt: "Model it as a purchase lease option: option fee, monthly payment to the owner, what you can let it for (single let, rooms or serviced accommodation), monthly profit during the option, the agreed purchase price against today's value, and the option term. Flag that it needs a specialist solicitor and that the owner must take independent legal advice." },
  SA: { name: "Owned serviced accommodation", prompt: "Model it as an owned serviced accommodation: purchase and furnishing costs, stamp duty, mortgage (holiday-let or SA products, assume 6% interest-only unless given), nightly rate and occupancy at 60%, 80% and 100%, platform fees, cleaning, bills, council tax or business rates, net profit, yield and return on cash. Check planning and the lease. In London, the 90-night rule only limits stays of under 90 consecutive nights, so corporate or mid-term lets of 90+ nights can fill the rest of the year." },
  Commercial: { name: "Commercial property", prompt: "Model it as commercial property: rent or price, lease length, break clauses and tenant covenant if known, business rates and service charges, net initial yield, void risk and re-letting costs, and use class. For conversions to residential, mention permitted development and prior approval." },
};

const STRATEGY_FORMAT = `Also include:
strategy_metrics (array of up to 8 {"label": string, "value": string}: the key figures for this strategy, for example yield, cash flow, return on cash or profit margin; label estimates "(est.)"),
better_strategy (string: if another strategy clearly suits this property better, name it and say why in one sentence; otherwise "").`;

// ---------- reading listing links ----------
// When the user pastes a link, read the advert first so the analysis has the real details.
// Pages are fetched directly only from known property sites (never arbitrary hosts); anything
// else, or a site that blocks the request, is read through OpenAI's web search instead.
const propertyHosts = () => [...new Set(Object.values(SITES).flatMap((s) => s.domains)), "onthemarket.com", "primelocation.com", "zoopla.co.uk", "purplebricks.co.uk", "home.co.uk", "idealflatmate.co.uk", "roomgo.co.uk", "openrent.com"];/* SITES is defined further down */
const MAX_LINKS = 3;
export type LinkRead = { url: string; ok: boolean; via: "page" | "search" | "none"; note?: string };

const decode = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&pound;/g, "£").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
function pageText(html: string) {
  const meta = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description|twitter:description)["'][^>]*content=["']([^"']+)["']/gi)].map((m) => decode(m[1]));
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim());
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).join("\n").slice(0, 4000);
  const body = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(?:br|\/p|\/li|\/h\d|\/div|\/tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return [title && `Title: ${title}`, meta.length && `Summary: ${[...new Set(meta)].join(" | ")}`, ld && `Structured data: ${ld}`, `Page text:\n${body.slice(0, 7000)}`].filter(Boolean).join("\n");
}
const BLOCKED = /captcha|are you a robot|access denied|verify you are human|enable javascript|cf-chl|just a moment/i;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-GB,en;q=0.9",
};

async function fetchPage(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (!propertyHosts().some((d) => host === d || host.endsWith(`.${d}`))) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-GB,en;q=0.9" } });
    // Stay on property sites even after redirects.
    const finalHost = new URL(r.url || url).hostname.toLowerCase();
    if (!propertyHosts().some((d) => finalHost === d || finalHost.endsWith(`.${d}`))) return null;
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) return null;
    const text = pageText((await r.text()).slice(0, 1_500_000));
    return text.length > 400 && !BLOCKED.test(text.slice(0, 1500)) ? text : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function searchPage(url: string, level: LevelId) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const prompt = `Open this exact property advert and read it: ${url}
Return JSON: {"found": true | false (false if you could not open this exact advert), "status": string (e.g. "available", "let agreed", "under offer", "sold", "removed"), "title": string, "price": string (with the period, e.g. "£1,450 pcm" or "£210,000"), "property_type": string, "bedrooms": string, "bathrooms": string, "address_or_area": string, "postcode": string, "furnished": string, "deposit": string, "bills": string, "available_from": string, "advertiser": string (private landlord, agent or company, and name if shown), "key_features": [strings], "description": string (the advert text, up to 250 words), "restrictions": string (pets, DSS, sharers, short lets or subletting if mentioned)}.
Only report what the advert says. Use "" when a detail isn't shown. Never guess.`;
  const { parsed } = await webJson(prompt, [host], level, "medium", "low");
  if (parsed.found === false || !(parsed.price || parsed.description || parsed.title)) return null;
  return Object.entries(parsed).filter(([k, v]) => k !== "found" && v !== "" && v != null && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join("; ") : String(v)}`).join("\n");
}

export async function readLinks(input: string, level: LevelId) {
  const urls = [...new Set((input.match(/https?:\/\/[^\s<>"')]+/gi) || []).map((u) => u.replace(/[.,;]+$/, "")))]
    .filter((u) => { try { const x = new URL(u); return x.protocol === "https:" && !/^\d+\.\d+\.\d+\.\d+$/.test(x.hostname); } catch { return false; } })
    .slice(0, MAX_LINKS);
  const reads: LinkRead[] = [];
  const parts: string[] = [];
  for (const url of urls) {
    let text = await fetchPage(url);
    let via: LinkRead["via"] = text ? "page" : "none";
    if (!text) {
      try { text = await searchPage(url, level); if (text) via = "search"; } catch (error) { console.warn("Could not read listing", url, errText(error)); }
    }
    reads.push({ url, ok: !!text, via, ...(text ? {} : { note: "The page couldn't be opened" }) });
    parts.push(text
      ? `--- Listing details read from ${url} ---\n${text}`
      : `--- ${url} could not be opened. Say so plainly and ask the user to paste the advert text; don't treat the link as missing information about the deal itself. ---`);
  }
  return { reads, extra: parts.join("\n\n") };
}

// ---------- market evidence ----------
// Analyst and Expert look up comparable rents, nightly rates and prices before judging a deal,
// so the numbers rest on evidence rather than the advert's claims. Only sources the search
// really returned are kept.
export type Evidence = { what: string; figure: string; source: string; url: string };
async function marketEvidence(deal: string, level: LevelId, strategy?: string) {
  const st = strategy && STRATEGIES[strategy];
  const depth = level === "deep" ? "Search thoroughly: find at least 3 comparables for each figure that matters, note the range, and check each rule on the council's own website."
    : level === "standard" ? "Find the most useful comparables for each figure and check the council's rules."
    : "Do a quick local check: a few comparables for the main figure and the council's key rule.";
  const prompt = `You are researching the local market for a UK property deal${st ? ` being assessed as ${st.name}` : ""}. It can be anywhere in England, Scotland, Wales or Northern Ireland.
First work out exactly where it is: the neighbourhood or street, town or city, postcode district, the local council (local authority, or London borough) and the nation. Then search the web for evidence about THAT area specifically, not national or London averages:
- comparable long-let rents for similar properties in the same postcode district or neighbourhood (Rightmove, Zoopla, OpenRent; SpareRoom for rooms),
- for short lets and serviced accommodation: nightly rates, occupancy and seasonality for similar listings nearby (Airbnb and Booking.com listings, AirDNA, Airbtics or similar),
- for purchases: recent sold prices and asking prices for similar nearby properties (Rightmove or Zoopla sold prices, Land Registry, Registers of Scotland),
- what drives demand locally: universities, hospitals, large employers, business parks, tourism, events, stations and transport links,
- the council's own rules: HMO and selective licensing, Article 4 directions, second-home or empty-home council tax premiums, short-term let licensing or control areas (Scotland), holiday-let rules (Wales), and any local planning policy on short lets.
${depth}
Only report figures and rules you actually found, each with its source page. Never estimate here.

Deal:
${deal.slice(0, 7000)}

Return JSON: {"location": string (neighbourhood, town, postcode district), "council": string, "nation": string,
"demand_drivers": [short strings, e.g. "University of Leeds, 1 mile"],
"local_rules": [short strings, e.g. "Leeds selective licensing in Harehills and Beeston"],
"benchmarks": [{"label": string (e.g. "2 bed rents, LS6"), "value": string (e.g. "£1,050-£1,250 pcm")}],
"evidence": [{"what": string, "figure": string, "source": string (site or publisher), "url": string}],
"summary": string (max 80 words: what the local evidence says about the deal's claimed figures)}.`;
  const { parsed, seen } = await webJson(prompt, [], level, level === "deep" ? "high" : level === "standard" ? "medium" : "low", "low");
  const evidence: Evidence[] = (Array.isArray(parsed.evidence) ? parsed.evidence : [])
    .filter((e: unknown): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e: Record<string, unknown>) => ({ what: String(e.what || "").slice(0, 140), figure: String(e.figure || "").slice(0, 120), source: String(e.source || "").slice(0, 80), url: String(e.url || "") }))
    .filter((e: Evidence) => e.figure && /^https?:\/\//.test(e.url) && seen.size > 0 && seen.has(normalise(e.url)))
    .slice(0, level === "deep" ? 12 : 6);
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map((x) => String(x || "").slice(0, 160)).filter(Boolean).slice(0, n);
  const benchmarks = (Array.isArray(parsed.benchmarks) ? parsed.benchmarks : [])
    .filter((b: unknown): b is Record<string, unknown> => !!b && typeof b === "object" && !!(b as Record<string, unknown>).value)
    .map((b: Record<string, unknown>) => ({ label: String(b.label || "").slice(0, 80), value: String(b.value || "").slice(0, 80) })).slice(0, 8);
  // Benchmarks and rules are only trusted when at least one real source backs the research.
  if (!evidence.length) return null;
  return {
    location: String(parsed.location || "").slice(0, 120), council: String(parsed.council || "").slice(0, 80), nation: String(parsed.nation || "").slice(0, 40),
    demand_drivers: list(parsed.demand_drivers, 6), local_rules: list(parsed.local_rules, 6), benchmarks,
    summary: String(parsed.summary || "").slice(0, 700), evidence,
  };
}

export const runAnalysis = async (deal: string, level: LevelId, strategy?: string) => {
  const { reads, extra } = await readLinks(deal, level);
  let input = extra ? `${deal}\n\n${extra}` : deal;
  let market: Awaited<ReturnType<typeof marketEvidence>> = null;
  // Every level researches the property's own area first; Scout does a quick check.
  try { market = await marketEvidence(input, level, strategy); } catch (error) { console.warn("Local research failed", errText(error)); }
  input += market
    ? `\n\n--- Local research for ${market.location}${market.council ? ` (${/council|borough|authority/i.test(market.council) ? market.council : `${market.council} council`}${market.nation ? `, ${market.nation}` : ""})` : ""} ---
Local benchmarks: ${market.benchmarks.map((b) => `${b.label}: ${b.value}`).join("; ") || "none found"}
Demand drivers: ${market.demand_drivers.join("; ") || "none found"}
Council rules: ${market.local_rules.join("; ") || "none found"}
Evidence:\n${market.evidence.map((e) => `- ${e.what}: ${e.figure} (${e.source})`).join("\n")}
Summary: ${market.summary}`
    : "\n\n--- No local evidence could be gathered from the web. Use conservative figures for the property's own area and say they are unverified. ---";
  const result = await analyse(input, level, strategy);
  return { ...result, ...(reads.length ? { links_read: reads } : {}), ...(market ? { market_evidence: market } : {}) };
};

const analyse = (deal: string, level: LevelId, strategy?: string) => {
  const st = strategy && STRATEGIES[strategy];
  const focus = st
    ? `The user wants this deal analysed as: ${st.name}. ${st.prompt} Judge the verdict and score for this strategy.`
    : "Work out which strategy the details describe (or suit best) and analyse it for that, saying which you chose in the summary.";
  return complete(`${BASE_PROMPT}\n\n${focus}\n${STRATEGY_FORMAT}\n\n${LEVEL_PROMPT[level]}`, deal, level);
};

const RANK_PROMPT = `You are Deal Pro's UK property deal sourcer. You are given Deal Finder search results as JSON (each has an id, site, type, beds, area, postcode and either a monthly rent or an asking price) plus the user's search filters. Rank them by how good they are as property deals for the user's strategy: rent-to-rent / serviced accommodation for rentals; buy-to-let, HMO, BRRR or serviced accommodation for purchases. Estimate a realistic nightly rate or rent for the location where needed and say it is an estimate.

Judge each listing on the user's strategy from the filters ("strategy"; "auto" means R2SA for rentals and buy-to-let for purchases):
- R2SA / serviced accommodation: monthly profit at 80% occupancy, break-even occupancy and short-stay demand.
- R2R / HMO by the room: room rents for the area times rooms, minus rent or mortgage, bills and voids; licensing and Article 4.
- Buy-to-let: gross and net yield and monthly cash flow after a mortgage.
- BRRR: likely value after works against price plus refurbishment, and money left in after a 75% refinance.
- Flip: likely resale value from comparable sales against price, refurbishment, costs and stamp duty; margin on resale value.
- Lease option, commercial and others: the figures that matter for that route.
Never talk about occupancy or nightly rates unless the strategy is short lets. Do not use the following R2SA method for other strategies.
For R2SA rentals, likely monthly profit at 80% occupancy (revenue = 24 nights x nightly rate, minus 15% platform fees, £45 cleaning per 3-night stay, rent and about £150 other costs), break-even occupancy, for purchases, gross yield and cash flow; price or rent level against the area, demand for short stays in that location, and compliance risk (in London, stays of under 90 consecutive nights are limited to 90 nights a year without planning permission; corporate and mid-term lets of 90+ nights don't count, so note when a London deal would need them; HMO and Article 4 where relevant). Treat nightly rates as estimates and say so. If the filters include "notes" (the user's own criteria in their words), rank listings that meet them higher and say which criteria each pick meets or misses. Never invent facts about a specific listing. The id is only for matching your picks to the results: never mention ids anywhere in your text. When you compare listings, name them by type and street or area (for example "the 1 bed flat on Adam & Eve Court").

You may also get "search_summary": how many listings each site returned, how many links were removed as dead or taken, and how many couldn't be confirmed. Use it to explain the search.

Return valid JSON with these keys:
explanation (plain English, 80-150 words, written to the user: what the search found across the sites, how prices compare with what's normal for the area, which areas, property types or sites look best value and why, how well the results match the user's criteria and notes, and anything notable such as removed dead links or thin results),
highlights (array of 3-6 short, specific findings, e.g. "The cheapest 2 beds are in LS6, from £950 pcm" or "Rightmove had the most matches"),
summary (plain English, max 40 words: what the best options have in common),
scores (array with one entry for EVERY listing given, best first: {"id": string, "score": integer 0-100, "verdict": "Strong" | "Potential" | "Weak"}),
picks (array, best first, of {"id": string, "score": integer 0-100, "verdict": "Strong" | "Potential" | "Weak", "reason": string, "key_figure": string (the main figure for the strategy, labelled and marked as an estimate, e.g. "Est. profit at 80% occupancy: £900/month", "Est. gross yield: 7.4%", "Est. margin after refurb: 18%")}; the same scores as in "scores"),
watch_outs (array of short strings that apply across these results).`;

const RANK_LEVEL: Record<LevelId, string> = {
  quick: "Return only the 3 best picks, with a one-sentence reason each, but still score every listing in \"scores\". Keep the explanation under 80 words and give at most 2 watch_outs.",
  standard: "Return the 10 best picks, with a two-sentence reason each covering the numbers and the main risk.",
  deep: `Return the 10 best picks. For each, give a thorough reason covering the numbers, local demand, the biggest risk and whether it survives a 20% lower nightly rate. Also add "notes" to each pick (array of short strings: compliance points and what to check with the landlord).`,
};

export const runRank = (payload: string, level: LevelId) => complete(`${RANK_PROMPT}\n\n${RANK_LEVEL[level]}`, payload, level);

// ---------- live Deal Finder search ----------
// Each ticked site is searched separately with OpenAI's web search, restricted to that
// site's domain. Only listing URLs that the search actually returned are kept, so the AI
// can't invent listings.
// "listing" matches the URL of a single advert on that site, and "example" shows the model that
// shape. Search-results, area and category pages don't match, so they are never shown as listings.
// Sites that only list homes to rent, so they're skipped when searching for property to buy.
export const RENT_ONLY = new Set(["OpenRent", "SpareRoom"]);
export const SITES: Record<string, { label: string; domains: string[]; what: string; listing: RegExp; example: string }> = {
  OpenRent: { label: "OpenRent", domains: ["openrent.co.uk"], what: "property to rent, mostly from private landlords", listing: /openrent\.co\.uk\/(?:property-to-rent\/[^?#]+\/)?\d{5,}\/?(?:[?#]|$)/i, example: "https://www.openrent.co.uk/property-to-rent/leeds/2-bed-flat-park-lane/1234567" },
  SpareRoom: { label: "SpareRoom", domains: ["spareroom.co.uk"], what: "whole properties and rooms to rent", listing: /spareroom\.co\.uk\/(?:flatshare\/[^#]*[?&](?:flatshare_id|advert_id)=\d+|flatshare\/[^?#]+\/\d{5,}\/?(?:[?#]|$))/i, example: "https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=12345678" },
  Gumtree: { label: "Gumtree", domains: ["gumtree.com"], what: "property to rent or buy", listing: /gumtree\.com\/p\/[^/?#]+\/[^/?#]+\/\d{6,}/i, example: "https://www.gumtree.com/p/property-to-rent/2-bed-flat-in-leeds/1234567890" },
  Rightmove: { label: "Rightmove", domains: ["rightmove.co.uk"], what: "residential property to rent or buy", listing: /rightmove\.co\.uk\/properties\/\d{6,}/i, example: "https://www.rightmove.co.uk/properties/123456789" },
  Zoopla: { label: "Zoopla", domains: ["zoopla.co.uk"], what: "residential property to rent or buy", listing: /zoopla\.co\.uk\/(?:to-rent|for-sale|new-homes)\/details\/\d{6,}/i, example: "https://www.zoopla.co.uk/to-rent/details/12345678/" },
  Facebook: { label: "Facebook Marketplace", domains: ["facebook.com"], what: "Facebook Marketplace property listings", listing: /facebook\.com\/marketplace\/item\/\d{6,}/i, example: "https://www.facebook.com/marketplace/item/1234567890123456/" },
  RightmoveCommercial: { label: "Rightmove Commercial", domains: ["rightmove.co.uk"], what: "commercial property to let or buy (rightmove.co.uk/commercial-property)", listing: /rightmove\.co\.uk\/(?:properties\/\d{6,}|commercial-property-(?:to-let|for-sale)\/property-\d{6,})/i, example: "https://www.rightmove.co.uk/properties/123456789" },
  Realla: { label: "Realla", domains: ["realla.co"], what: "commercial property to let or buy", listing: /realla\.co\/(?:m|p|listing|properties)\/[^?#]*\d{4,}/i, example: "https://realla.co/m/12345678-office-to-let-high-street-leeds" },
  NovaLoca: { label: "NovaLoca", domains: ["novaloca.com"], what: "commercial property, offices and shops to let or buy", listing: /novaloca\.com\/[^?#]*\/(?:\d{5,}|[^/?#]*-\d{5,})\/?(?:[?#]|$)/i, example: "https://www.novaloca.com/offices/to-let/leeds/high-street/12345" },
  LoopNet: { label: "LoopNet", domains: ["loopnet.co.uk", "loopnet.com"], what: "UK commercial property to let or buy", listing: /loopnet\.(?:co\.uk|com)\/Listing\/[^?#]+\/\d{5,}/i, example: "https://www.loopnet.co.uk/Listing/1-High-Street-Leeds/12345678/" },
};
// Pages that show many listings rather than one.
const SEARCH_PAGE = /\/(?:search|find|results|browse|property-to-rent\/?$|properties-to-rent|to-rent\/?(?:property\/)?[^/]*\/?$|for-sale\/?(?:property\/)?[^/]*\/?$)|[?&](?:location|searchLocation|q|query|search|keywords?|locationIdentifier)=/i;
export const isListingUrl = (site: string, url: string) => {
  const conf = SITES[site];
  return !!conf && conf.listing.test(url) && !SEARCH_PAGE.test(url.replace(/[?&](?:flatshare_id|advert_id)=\d+/i, ""));
};

// How hard each level searches. Expert runs many rounds per site from different angles,
// then opens the best listings to confirm they're still available.
const SEARCH_LEVEL: Record<LevelId, { passes: number; perPass: number; context: "low" | "medium" | "high"; effort: Effort; verify: number }> = {
  // Scout: one quick look per site. Analyst: two rounds per site from different angles. Expert: eight rounds plus checks.
  // Every level opens the best listings to confirm they are still available; deeper levels check more.
  quick: { passes: 1, perPass: 5, context: "low", effort: "low", verify: 10 },
  standard: { passes: 2, perPass: 12, context: "medium", effort: "low", verify: 25 },
  deep: { passes: 8, perPass: 15, context: "high", effort: "medium", verify: 60 },
};

// Each round searches from a different angle so later rounds find listings earlier ones missed.
const ANGLES = [
  "Start with the newest listings (added in the last few days), then the most relevant current ones.",
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
  priv?: boolean; furn?: string; type?: string; notes?: string; fresh?: string; strategy?: string;
};

export type Listing = {
  site: string; id: string; title: string; type: string; beds: number | null; area: string; postcode: string;
  price: number; mode: "rent" | "buy"; private: boolean | null; furnished: string; url: string; found: string;
  verified?: "available" | "unavailable" | "unknown";
  checkedAt?: string;
  // When the advert was added or last updated, as an ISO date, when the site shows it.
  listedAt?: string;
  // The advert says it's in high demand, has a closing date or viewings are booked up: likely to go soon.
  hot?: boolean;
  // "live": the page opened and shows the advert; "gone": 404, removed, or bounced to a search page;
  // "unknown": the site blocked the check, so the AI has to open it instead.
  link?: "live" | "gone" | "unknown";
  confirmed?: boolean;
  details?: { deposit: string; availableFrom: string; listed?: string; highlights: string[] };
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

// What suits each strategy, so the search looks for the right kind of listing.
const STRATEGY_SEARCH: Record<string, string> = {
  R2SA: "suitable for serviced accommodation (furnished or furnishable, good location for short stays, landlord open to a company let)",
  R2R: "suitable for rent-to-rent let by the room (enough bedrooms, landlord open to sharers or a company let)",
  BTL: "suitable for buy-to-let (sound condition, good rental demand)",
  HMO: "suitable for an HMO (several bedrooms, space for shared kitchen and bathrooms, ideally licensable or already an HMO)",
  BRRR: "suitable for BRRR: properties needing refurbishment or modernisation, below market value, auction, probate or tired properties",
  Flip: "suitable for a flip: properties needing refurbishment or modernisation, below market value, auction, probate, chain-free or quick sale",
  SA: "suitable for owned serviced accommodation (city centre or tourist area, planning for short lets)",
  LeaseOption: "where the owner may be open to a lease option or creative deal (long time on the market, price reduced, motivated seller)",
  Commercial: "commercial property",
};

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
  const notes = typeof f.notes === "string" ? f.notes.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const fresh = Number(f.fresh) > 0 ? Number(f.fresh) : 0;
  const hint = STRATEGY_SEARCH[String(f.strategy || "")];
  if (hint) parts.push(hint);
  if (fresh) parts.push(`only listings added or updated in the last ${fresh === 1 ? "24 hours" : `${fresh} days`} (newest first)`);
  return parts.filter(Boolean).join(", ") + (notes ? `. The user's own criteria, in their words (follow them where the listing shows it): "${notes}"` : "");
}

const hostMatches = (url: string, domains: string[]) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
};
const normalise = (url: string) => { try { const u = new URL(url); u.hash = ""; return u.toString().replace(/\/$/, ""); } catch { return url; } };

async function webJson(prompt: string, domains: string[], level: LevelId, context: "low" | "medium" | "high", effort: Effort) {
  const client = ai();
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

// Turns "Added today", "Reduced on 28/09/2026", "3 days ago" or "12 Sept 2026" into an ISO date.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseListed(text: string, now = Date.now()): string {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return "";
  const day = 864e5;
  const iso = (ms: number) => (ms > now + day || ms < now - 400 * day ? "" : new Date(ms).toISOString());
  if (/\b(just now|today|new today|hours? ago|minutes? ago)\b/.test(t)) return iso(now);
  if (/\byesterday\b/.test(t)) return iso(now - day);
  let m = t.match(/(\d+)\s*(day|week|month)s?\s+ago/);
  if (m) return iso(now - Number(m[1]) * (m[2] === "day" ? day : m[2] === "week" ? 7 * day : 30 * day));
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) { const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]); return iso(Date.UTC(y, Number(m[2]) - 1, Number(m[1]))); }
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})\b/);
  if (m && MONTHS.includes(m[2])) return iso(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2]), Number(m[1])));
  m = t.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && MONTHS.includes(m[1])) return iso(Date.UTC(Number(m[3]), MONTHS.indexOf(m[1]), Number(m[2])));
  return "";
}

// Several places can be searched at once: "Liverpool, Manchester, Leeds" or "Watford and Luton".
export const MAX_LOCATIONS = 6;
export function splitLocations(loc: unknown): string[] {
  const parts = String(loc || "").split(/\s*(?:[,;/|\n]|\band\b|\bor\b|&|\+)\s*/i).map((x) => x.trim()).filter((x) => x.length > 1);
  return [...new Map(parts.map((x) => [x.toLowerCase(), x])).values()].slice(0, MAX_LOCATIONS);
}

async function searchSite(site: string, f: Filters, level: LevelId, pass: number, exclude: string[], want?: number): Promise<Listing[]> {
  const conf = SITES[site];
  const lv = { ...SEARCH_LEVEL[level], ...(want ? { perPass: want } : {}) };
  const buy = f.mode === "buy";
  const skip = exclude.length ? `\nYou've already found these, so don't return them again:\n${exclude.slice(-80).join("\n")}` : "";
  const prompt = `Search ${conf.domains[0]} (${conf.what}) for listings that are currently available: ${describe(f)}.
${ANGLES[pass % ANGLES.length]} ${level === "quick" ? `Do one quick search and return up to ${lv.perPass} matching individual listings.` : `Search several times with different wording until you have up to ${lv.perPass} matching individual listings.`} Only return individual listing pages: one property per URL, shaped like ${conf.example}. Never return search-results, area, category or map pages, even if they show listings; open the individual advert and use its URL. Skip adverts marked let agreed, under offer, sold STC or no longer available.${skip}
Return JSON: {"listings": [{"title": string, "type": string (e.g. "2 bed flat", "Office"), "beds": number or null (0 for studio), "area": string (street/area and town), "postcode": string (postcode district like "M1" or "SE1", "" if unknown), "price": number (${buy ? "asking price in GBP" : "monthly rent in GBP; convert weekly rents x 52 / 12"}), "url": string (the listing page URL exactly as found), "furnished": "Furnished" | "Unfurnished" | "Part furnished" | "Not stated", "private_landlord": true | false | null, "added": string (when the advert was added, reduced or updated, exactly as the site shows it, e.g. "Added today", "Added on 28/09/2026", "3 days ago"; "" if not shown)}]}.
Prefer the newest listings. Only include listings you actually found in the search results, with the URL exactly as the search returned it. Never build or guess a URL from an ID or address, and never invent a listing or price. If you find none, return {"listings": []}.`;
  const { parsed, seen } = await webJson(prompt, conf.domains, level, lv.context, lv.effort);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const out: Listing[] = [];
  for (const x of (parsed.listings || []) as Array<Record<string, unknown>>) {
    const url = String(x.url || "");
    if (!/^https:\/\//.test(url) || !hostMatches(url, conf.domains) || !isListingUrl(site, url)) continue;
    // Listings found by reading a site's search page aren't in the search sources, so they aren't dropped
    // here: every link is opened and checked before it is shown, which removes anything made up.
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
      ...(parseListed(String(x.added || "")) ? { listedAt: parseListed(String(x.added || "")) } : {}),
    });
  }
  return out;
}

// Expert only: open listing pages to confirm they're still available and fill in details.
async function verifyBatch(batch: Listing[], level: LevelId) {
  const domains = [...new Set(batch.flatMap((l) => SITES[l.site].domains))];
  const prompt = `Open each of these property listing pages and check them:
${batch.map((l, i) => `${i + 1}. ${l.url}`).join("\n")}
For each, confirm the page opens (not a 404 or "page not found"), is a single property advert (not a search-results or area page), and whether it is still available (not let agreed, under offer, sold STC, expired or removed), and read the details from the page itself.
Return JSON: {"checks": [{"url": string (exactly as given), "opened": true | false (false if you could not open this exact page), "is_listing": true | false, "available": true | false | null, "title": string (the advert's own title), "type": string (e.g. "2 bed flat"), "area": string (street/area and town as the advert shows), "listed": string (the date it was added or last updated, if shown), "price": number or null (${batch[0].mode === "buy" ? "asking price" : "monthly rent"} in GBP), "beds": number or null, "deposit": string, "available_from": string, "furnished": string, "private_landlord": true | false | null, "highlights": [short strings: key features, restrictions, bills, pets, DSS, short lets allowed or not]}]}.
Only report what the pages actually say. Use null or "" when a detail isn't shown.`;
  const { parsed } = await webJson(prompt, domains, level, level === "quick" ? "medium" : "high", level === "quick" ? "low" : "medium");
  const byUrl = new Map(batch.map((l) => [normalise(l.url), l]));
  for (const c of (parsed.checks || []) as Array<Record<string, any>>) {
    const l = byUrl.get(normalise(String(c.url || "")));
    if (!l) continue;
    // A definite "gone" or "let agreed" removes it; not being able to open it never undoes a direct check.
    l.verified = c.is_listing === false || c.available === false ? "unavailable"
      : c.opened !== false && c.available === true ? "available"
      : l.link === "live" ? "available" : "unknown";
    if (c.opened === false) continue;
    // Describe the row from the advert itself, so the details match what the link opens.
    if (l.verified === "available") {
      if (c.title) l.title = String(c.title).slice(0, 140);
      if (c.type) l.type = String(c.type).slice(0, 60);
      if (c.area) l.area = String(c.area).slice(0, 120);
    }
    l.checkedAt = new Date().toISOString();
    const price = Math.round(Number(c.price));
    if (Number.isFinite(price) && price > 0) l.price = price;
    if (Number.isFinite(Number(c.beds)) && c.beds !== null) l.beds = Math.round(Number(c.beds));
    if (typeof c.private_landlord === "boolean") l.private = c.private_landlord;
    if (c.furnished) l.furnished = String(c.furnished).slice(0, 30);
    l.details = {
      deposit: String(c.deposit || "").slice(0, 60),
      availableFrom: String(c.available_from || "").slice(0, 60),
      listed: String(c.listed || "").slice(0, 60),
      highlights: Array.isArray(c.highlights) ? c.highlights.slice(0, 8).map((h: unknown) => String(h).slice(0, 120)) : [],
    };
    if (!l.listedAt && parseListed(String(c.listed || ""))) l.listedAt = parseListed(String(c.listed || ""));
    if (HOT_TEXT.test(l.details.highlights.join(" "))) l.hot = true;
  }
}

// A search that can be paused and resumed, so Expert can run far longer than one
// 15-minute background function: each run works until its deadline, saves this state,
// and the runner starts another run to continue.
export type SearchState = {
  filters: Filters; sites: string[]; phase: "search" | "check" | "verify" | "rank" | "done";
  round: number; checkAt?: number; verifyAt: number; listings: Listing[]; removed?: number;
  // A refresh starts from the member's current results: they are re-checked and new ones added.
  previous?: string[];
  widened?: boolean;
  sites_status: Record<string, { status: string; found: number; round?: number; rounds?: number; error?: string; detail?: string }>;
  ranking?: Record<string, unknown> | null; startedAt: string;
};

export function newSearch(input: string, level: LevelId): SearchState {
  const { filters = {}, sites = [], existing = [] } = JSON.parse(input) as { filters?: Filters; sites?: string[]; existing?: Array<Record<string, unknown>> };
  const ticked = sites.filter((s) => s in SITES);
  // Rental-only sites can't have property for sale; keep them out of a purchase search.
  const wanted = filters.mode === "buy" && ticked.some((s) => !RENT_ONLY.has(s)) ? ticked.filter((s) => !RENT_ONLY.has(s)) : ticked;
  // Current results to re-check: only real listing links on the ticked sites, with their checks reset.
  const keep: Listing[] = [];
  for (const x of Array.isArray(existing) ? existing.slice(0, 200) : []) {
    const site = String(x.site || ""), url = String(x.url || "");
    if (!wanted.includes(site) || !/^https:\/\//.test(url) || !isListingUrl(site, url) || keep.some((k) => k.id === normalise(url))) continue;
    const price = Math.round(Number(x.price));
    if (!Number.isFinite(price) || price <= 0) continue;
    const beds = x.beds == null || x.beds === "" ? null : Math.max(0, Math.round(Number(x.beds)));
    keep.push({
      site, id: normalise(url), url, title: String(x.title || "").slice(0, 140), type: String(x.type || "Property").slice(0, 60),
      beds: Number.isFinite(beds as number) ? beds : null, area: String(x.area || "").slice(0, 120), postcode: String(x.postcode || "").toUpperCase().slice(0, 8),
      price, mode: x.mode === "buy" ? "buy" : "rent", private: typeof x.private === "boolean" ? x.private : null,
      furnished: String(x.furnished || "Not stated").slice(0, 30), found: String(x.found || "").slice(0, 20),
      ...(typeof x.listedAt === "string" && !Number.isNaN(Date.parse(x.listedAt)) ? { listedAt: x.listedAt } : {}),
    });
  }
  return {
    filters, sites: wanted, phase: "search", round: 0, verifyAt: 0, listings: keep, previous: keep.map((l) => l.id), startedAt: new Date().toISOString(),
    sites_status: Object.fromEntries(wanted.map((s) => [s, { status: "searching", found: 0, round: 0, rounds: SEARCH_LEVEL[level].passes }])),
  };
}

export const searchProgress = (st: SearchState) => ({ phase: st.phase, sites: st.sites_status, found: st.listings.length, checked: st.checkAt || 0, verified: st.verifyAt, removed: st.removed || 0 });

// ---------- link checks ----------
// Every listing's link is opened before it is shown. Pages that 404, bounce to a search or home
// page, or say the advert has gone are removed. Sites that block the check are left "unknown"
// for the AI to open instead.
const GONE_TEXT = /(no longer available|no longer on the market|no longer listed|has been removed|been taken down|advert has expired|ad has expired|listing (?:has )?expired|listing not found|property not found|advert not found|page not found|page (?:you|you're|you are) looking for|couldn['’]t find (?:that|the|this) page|this (?:ad|advert|listing|property) is no longer|\b404\b\W{0,3}(?:error|not found|page))/i;
const HOT_TEXT = /high demand|multiple (?:offers|applications|enquiries)|viewings? (?:are )?(?:now )?(?:fully )?booked|closing date|best and final|limited viewings|lots of interest/i;
const TAKEN_TITLE = /\b(let agreed|under offer|sold stc|sold subject to contract|reserved)\b/i;
export async function checkLink(l: Listing): Promise<"live" | "gone" | "unknown"> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(l.url, { redirect: "follow", signal: ctl.signal, headers: BROWSER_HEADERS });
    if (r.status === 404 || r.status === 410) return "gone";
    const final = r.url || l.url;
    // A removed advert often redirects to a search or home page.
    if (normalise(final) !== normalise(l.url) && !isListingUrl(l.site, final)) return "gone";
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) return "unknown";
    const text = pageText((await r.text()).slice(0, 1_500_000));
    if (text.length < 300 || BLOCKED.test(text.slice(0, 1500))) return "unknown";
    const head = text.slice(0, 2500);
    if (GONE_TEXT.test(head)) return "gone";
    const title = head.match(/^Title: (.*)$/m)?.[1]?.trim() || "";
    if (TAKEN_TITLE.test(title)) return "gone";
    const added = text.match(/\b(?:added|listed|posted|reduced|updated)\b[^.\n]{0,30}?(?:today|yesterday|\d+\s*(?:hours?|days?|weeks?|months?)\s+ago|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4})/i)?.[0];
    if (added) { const at = parseListed(added); if (at) l.listedAt = at; }
    if (HOT_TEXT.test(text.slice(0, 6000))) l.hot = true;
    if (title && !/rightmove|zoopla|openrent|spareroom|gumtree|facebook/i.test(title.replace(/[|\-–].*$/, "").trim())) l.title = title.replace(/\s*[|–-]\s*(Rightmove|Zoopla|OpenRent|SpareRoom|Gumtree|Facebook).*$/i, "").slice(0, 140);
    return "live";
  } catch { return "unknown"; } finally { clearTimeout(timer); }
}

export async function stepSearch(st: SearchState, level: LevelId, deadline: number, save: (st: SearchState) => Promise<void>) {
  const lv = SEARCH_LEVEL[level];
  const min = Number(st.filters.min) || 0, max = Number(st.filters.max) || Infinity;
  const known = () => new Set(st.listings.map((l) => l.id));
  const timeLeft = () => deadline - Date.now();

  // Rounds: every site is searched in parallel, each round from a new angle.
  while (st.phase === "search") {
    // Nothing found at all: run one more, wider round (the next angle: nearby areas or different wording).
    if (st.round >= lv.passes && !st.widened && !st.listings.length && st.sites.some((s) => st.sites_status[s]?.status !== "error")) st.widened = true;
    if (st.round >= lv.passes + (st.widened ? 1 : 0)) { st.phase = "check"; break; }
    if (timeLeft() < 4 * 60_000) return st;
    const round = st.round;
    await Promise.all(st.sites.map(async (site) => {
      if (st.sites_status[site]?.status === "error") return;
      try {
        const mine = st.listings.filter((l) => l.site === site).map((l) => l.url);
        // Each place is searched separately on this site, sharing out the listings wanted per round.
        const places = splitLocations(st.filters.loc);
        const want = places.length > 1 ? Math.max(5, Math.ceil((lv.perPass * 2) / places.length)) : undefined;
        const runs = await Promise.allSettled((places.length ? places : [""]).map((place) => searchSite(site, { ...st.filters, loc: place }, level, round, mine, want)));
        const ok = runs.filter((r): r is PromiseFulfilledResult<Listing[]> => r.status === "fulfilled");
        if (!ok.length) throw (runs[0] as PromiseRejectedResult).reason;
        const found = ok.flatMap((r) => r.value).filter((l) => l.price >= min && l.price <= max);
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

  // Check: open every listing's link directly, several at a time, and drop dead ones.
  if (st.phase === "check") {
    st.checkAt = st.checkAt || 0;
    while (st.checkAt < st.listings.length) {
      if (timeLeft() < 4 * 60_000) return st;
      const group = st.listings.slice(st.checkAt, st.checkAt + 8);
      await Promise.all(group.map(async (l) => { l.link = await checkLink(l); if (l.link === "live") { l.verified = "available"; l.checkedAt = new Date().toISOString(); } }));
      st.checkAt += group.length;
      if (st.checkAt % 24 === 0 || st.checkAt >= st.listings.length) await save(st);
    }
    const before = st.listings.length;
    st.listings = st.listings.filter((l) => l.link !== "gone");
    st.removed = (st.removed || 0) + before - st.listings.length;
    st.phase = "verify";
    await save(st);
  }

  // Verify: the AI opens the links the direct check couldn't confirm (taking turns across sites),
  // then, with any budget left, the cheapest confirmed ones to read their details.
  if (st.phase === "verify") {
    const byPrice = (a: Listing, b: Listing) => a.price / Math.max(1, a.beds ?? 1) - b.price / Math.max(1, b.beds ?? 1);
    const roundRobin = (list: Listing[]) => {
      const bySite = new Map<string, Listing[]>();
      for (const l of [...list].sort(byPrice)) bySite.set(l.site, [...(bySite.get(l.site) || []), l]);
      const out: Listing[] = [];
      for (let i = 0; out.length < list.length; i++) for (const sl of bySite.values()) if (sl[i]) out.push(sl[i]);
      return out;
    };
    const targets = [...roundRobin(st.listings.filter((l) => l.link !== "live")), ...roundRobin(st.listings.filter((l) => l.link === "live"))].slice(0, lv.verify);
    while (st.verifyAt < targets.length) {
      if (timeLeft() < 4 * 60_000) return st;
      const group = targets.slice(st.verifyAt, st.verifyAt + 20);
      const batches = Array.from({ length: Math.ceil(group.length / 5) }, (_, i) => group.slice(i * 5, i * 5 + 5));
      await Promise.all(batches.map((batch) => verifyBatch(batch, level).catch((error) => console.error("Verify failed", error))));
      st.verifyAt += group.length;
      await save(st);
    }
    // Drop listings the pages say are gone; confirmed listings come first, and only those are ranked.
    const before = st.listings.length;
    st.listings = st.listings.filter((l) => l.verified !== "unavailable");
    st.removed = (st.removed || 0) + before - st.listings.length;
    for (const l of st.listings) l.confirmed = l.verified === "available";
    st.listings.sort((a, b) => Number(!!b.confirmed) - Number(!!a.confirmed));
    st.phase = "rank";
    await save(st);
  }

  if (st.phase === "rank") {
    if (timeLeft() < 3 * 60_000) return st;
    if (st.listings.some((l) => l.confirmed)) {
      try {
        st.ranking = await runRank(JSON.stringify({
          filters: st.filters,
          search_summary: {
            sites: Object.fromEntries(st.sites.map((site) => [SITES[site].label, st.sites_status[site]?.status === "error" ? "couldn't be searched" : st.listings.filter((l) => l.site === site && l.confirmed).length])),
            removed_dead_or_taken_links: st.removed || 0,
            unconfirmed_hidden: st.listings.filter((l) => !l.confirmed).length,
          },
          listings: st.listings.filter((l) => l.confirmed).slice(0, level === "quick" ? 40 : 120).map((l, i) => ({
            id: String(i), site: SITES[l.site].label, type: l.type, beds: l.beds, area: l.area, postcode: l.postcode,
            [l.mode === "buy" ? "asking_price" : "rent_pcm"]: l.price,
            ...(l.details ? { checked_details: l.details, still_available: l.verified } : {}),
          })),
        }), level);
      } catch (error) {
        console.error("Ranking failed, retrying with Scout", error);
        try {
          st.ranking = await runRank(JSON.stringify({ filters: st.filters, listings: st.listings.filter((l) => l.confirmed).slice(0, 40).map((l, i) => ({
            id: String(i), site: SITES[l.site].label, type: l.type, beds: l.beds, area: l.area, postcode: l.postcode, [l.mode === "buy" ? "asking_price" : "rent_pcm"]: l.price,
          })) }), "quick");
        } catch (again) { console.error("Ranking failed", again); st.ranking = null; }
      }
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
