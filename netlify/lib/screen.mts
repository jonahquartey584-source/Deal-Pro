// Does an advert really match what the member asked for? The search can return a room in a shared
// house for a whole-property search, an office for a rent-to-rent search, or a property in the
// wrong town. This reads each advert's own title and description and says why one doesn't fit.
// Pure functions with no network, so every rule can be tested.

export type Kind = "whole" | "room" | "commercial" | "unknown";
export type ScreenListing = { site: string; title: string; type: string; beds: number | null; price: number; mode: "rent" | "buy"; area: string; postcode: string };
export type ScreenFilters = { strategy?: string; type?: string; notes?: string; loc?: string; planning?: string };
// What the AI saw when it opened the page itself (all optional).
export type Facts = { kind?: Kind; inArea?: boolean | null; restriction?: string; planning?: PlanningStatus };

// Planning: does the advert say the site has planning permission, an application in, or potential for it?
export type PlanningStatus = "granted" | "pending" | "potential" | "none";
const PLAN_GRANTED = /\b(?:(?:full|outline|detailed|reserved matters?|hybrid)\s+planning(?:\s+(?:permission|consent))?|planning\s+(?:permission|consent)\s+(?:has\s+been\s+|is\s+|was\s+)?(?:granted|approved|obtained|in\s+place|secured)|(?:granted|approved|passed)\s+planning|with\s+(?:full\s+|outline\s+)?planning|(?:benefits?|benefitting)\s+from\s+(?:full\s+|outline\s+)?planning|(?:prior\s+approval|lawful\s+development\s+certificate|certificate\s+of\s+lawful(?:ness)?)\s+(?:has\s+been\s+|was\s+)?(?:granted|approved|obtained)|consent(?:ed)?\s+(?:for|scheme)|planning\s+(?:approved|granted|consent))\b/i;
const PLAN_PENDING = /\b(?:planning\s+(?:application|submission)\s+(?:has\s+been\s+|was\s+|is\s+)?(?:submitted|lodged|made|pending|in)|(?:application|submission)\s+(?:has\s+been\s+|was\s+)?(?:submitted|lodged)|awaiting\s+(?:a\s+)?(?:planning\s+)?decision|pending\s+(?:planning|decision)|pre-?application\s+(?:advice|submitted))\b/i;
const PLAN_POTENTIAL = /\b(?:stpp|subject\s+to\s+(?:the\s+)?(?:necessary\s+|relevant\s+|appropriate\s+|usual\s+)?(?:planning|consents?)|planning\s+(?:potential|opportunity|uplift|gain)|(?:development|redevelopment|conversion|extension|expansion|refurbishment)\s+(?:potential|opportunity|scope|site|project)|(?:scope|potential|opportunity|ideal|suitable|subject)\s+(?:to|for)\s+(?:extend|convert|develop|redevelop|split|sub-?divide|add|build|create|change\s+of\s+use|conversion|development|redevelopment|residential|flats?)|permitted\s+development|class\s+(?:mA|q|r|o|m|ma|g)\b|change\s+of\s+use|prior\s+approval|(?:build|building)\s+plot|development\s+(?:land|plot)|vacant\s+(?:land|plot)|garden\s+plot|land\s+with)\b/i;

// Reads the advert's own words: "" when there is no text to judge. The sentence that says it is returned as the detail.
export function planningIn(text: string): { status: PlanningStatus; detail: string } | null {
  const body = String(text || "").slice(0, 20_000);
  if (body.length < 120) return null;
  const grab = (re: RegExp) => {
    const m = body.match(re);
    if (!m || m.index == null) return "";
    const from = Math.max(0, body.lastIndexOf(".", m.index) + 1, m.index - 120);
    const end = body.indexOf(".", m.index + m[0].length);
    return body.slice(from, end < 0 ? m.index + m[0].length + 100 : Math.min(end + 1, m.index + m[0].length + 140)).replace(/\s+/g, " ").trim().slice(0, 200);
  };
  // "No planning permission" or "planning permission refused" is not a grant.
  const denied = /\b(?:no|without|not\s+(?:yet\s+)?(?:have|got|obtained)|refused|rejected|lacks?)\s+(?:any\s+)?(?:full\s+|outline\s+)?planning\s+(?:permission|consent|approval)?\b|\bplanning\s+(?:permission|consent|approval|application)\s+(?:was\s+|has\s+been\s+)?(?:refused|rejected|denied|dismissed|expired|lapsed)\b/i.test(body);
  if (!denied) { const g = grab(PLAN_GRANTED); if (g) return { status: "granted", detail: g }; }
  const pe = grab(PLAN_PENDING); if (pe) return { status: "pending", detail: pe };
  const po = grab(PLAN_POTENTIAL); if (po) return { status: "potential", detail: po };
  return { status: "none", detail: "" };
}

const NOT_ROOM_WORD = "reception |living |dining |sitting |bath |shower |utility |family |games |store |wet |dressing |sun |play |drawing |box ";
const ROOM = new RegExp(`(?<!${NOT_ROOM_WORD})\\broom\\b|house\\s?shares?|flat\\s?shares?|houseshare|room only|per room`, "i");
const COMMERCIAL_TYPE = /\b(?:offices?|retail|warehouse|industrial|commercial|showroom|workshop|restaurant|caf[eé]|takeaway|pub|shop|storage|land|plot|car park|garage|studio space)\b/i;
const COMMERCIAL_TITLE = /\b(?:offices?|retail unit|shop|warehouse|industrial unit|commercial (?:property|unit|premises)|to let (?:-|–) (?:office|retail))\b/i;
const WHOLE_TEXT = /whole property|entire property|whole house|whole flat|entire house|entire flat/i;

const SHARERS = /\bno\s+(?:sharers?|sharing|house\s?shar(?:e|es|ers)|hmos?|multiple\s+(?:occupancy|occupiers|tenants))\b|\b(?:sharers?|sharing|hmos?|house\s?shares?)\s+(?:are\s+)?not\s+(?:allowed|permitted|accepted|considered|suitable)\b|\bnot\s+suitable\s+for\s+(?:sharers|sharing|hmos?)\b|\b(?:single\s+(?:family|household)|one\s+family)\s+(?:let|only|home)\b|\bfamily\s+(?:let|home)\s+only\b/i;
const SUBLET = /\bno\s+(?:sub-?let(?:ting|s)?|sub-?leas(?:e|ing)|airbnb|short[\s-]?lets?|holiday\s+lets?|serviced\s+accommodation|company\s+lets?|corporate\s+lets?)\b|\b(?:sub-?let(?:ting)?|short[\s-]?lets?|airbnb|company\s+lets?|holiday\s+lets?)\s+(?:is\s+|are\s+)?not\s+(?:allowed|permitted|accepted|considered)\b/i;
const NO_BENEFITS = /\bno\s+(?:dss|housing\s+benefit|lha|benefits?)\b|\b(?:dss|housing\s+benefit|benefits?)\s+(?:is\s+|are\s+)?not\s+(?:accepted|considered|allowed|permitted)\b/i;

// The strategy in use for this listing: the member's choice, or R2SA for rentals and BTL for purchases.
export function strategyOf(f: ScreenFilters, mode: "rent" | "buy") {
  const s = !f.strategy || f.strategy === "auto" ? (mode === "buy" ? "BTL" : "R2SA") : f.strategy;
  return s;
}

export function kindOf(l: ScreenListing, text = ""): Kind {
  const head = `${l.type} ${l.title}`;
  if (COMMERCIAL_TYPE.test(l.type) || COMMERCIAL_TITLE.test(l.title)) return "commercial";
  if (ROOM.test(head)) return "room";
  if (l.site === "SpareRoom" && !WHOLE_TEXT.test(`${head} ${text.slice(0, 3000)}`)) return "room";
  // A rent this low for a house of 3 or more bedrooms is the price of one room, not the whole home.
  if (l.mode === "rent" && l.beds != null && l.beds >= 3 && l.price / l.beds < 300) return "room";
  if (l.beds != null || /\b(?:house|flat|apartment|bungalow|maisonette|studio|terrace[d]?|detached)\b/i.test(head)) return "whole";
  return "unknown";
}

// A sentence in the advert that rules out the member's strategy ("no sharers", "no subletting"), or "".
export function restrictionIn(text: string, f: ScreenFilters, mode: "rent" | "buy" = "rent"): string {
  if (mode === "buy") return "";
  const body = text.slice(0, 20_000), strat = strategyOf(f, mode), notes = String(f.notes || "");
  const hit = (re: RegExp) => body.match(re)?.[0]?.replace(/\s+/g, " ").trim() || "";
  if (strat === "R2R" || strat === "HMO") return hit(SHARERS) || hit(SUBLET);
  if (strat === "R2SA") return hit(SUBLET);
  if (/\b(?:dss|lha|housing benefit|benefits|temporary accommodation)\b/i.test(notes)) return hit(NO_BENEFITS);
  return "";
}

const POSTCODE_FULL = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}\b/;
const POSTCODE_TOKEN = /^([A-Z]{1,2})(\d[A-Z\d]?)\b/i;
const areaLetters = (d: string) => d.replace(/\d.*$/, "").toUpperCase();
const places = (loc: unknown) => String(loc || "").split(/\s*(?:[,;/|\n]|\band\b|\bor\b|&|\+)\s*/i).map((x) => x.trim()).filter((x) => x.length > 1);

// When the member gave postcodes, a listing in a different postcode area that never mentions any of the
// places they named isn't "in or near" what they asked for.
export function outsideArea(l: ScreenListing, f: ScreenFilters, text = ""): string {
  const wanted = places(f.loc);
  const req = wanted.filter((p) => POSTCODE_TOKEN.test(p)).map((p) => p.toUpperCase().match(POSTCODE_TOKEN)![0]);
  if (!req.length) return "";
  const names = wanted.filter((p) => !POSTCODE_TOKEN.test(p)).map((p) => p.replace(/\(.*?\)/g, "").trim().toLowerCase()).filter((p) => p.length > 2);
  const own = (l.postcode || "").toUpperCase().match(POSTCODE_TOKEN)?.[0] || text.slice(0, 4000).toUpperCase().match(POSTCODE_FULL)?.[1] || "";
  if (!own) return "";
  if (req.some((r) => r === own || areaLetters(r) === areaLetters(own))) return "";
  const seen = `${l.area} ${text.slice(0, 8000)}`.toLowerCase();
  if (names.some((n) => seen.includes(n))) return "";
  return `Outside the area you asked for (${own})`;
}

// "" when the listing fits; otherwise a short reason it was left out.
export function mismatch(l: ScreenListing, f: ScreenFilters, facts: Facts = {}, text = ""): string {
  const strat = strategyOf(f, l.mode);
  const kind = facts.kind && facts.kind !== "unknown" ? facts.kind : kindOf(l, text);
  const commercialOk = strat === "Commercial" || strat === "Planning" || f.type === "commercial" || f.type === "land" || /^(?:RightmoveCommercial|Realla|NovaLoca|LoopNet)$/.test(l.site);
  if (kind === "commercial" && !commercialOk) return "Commercial, not a home";
  const wantsRooms = /\b(?:rooms? (?:to rent|in an?)|house\s?share|flat\s?share|single rooms?)\b/i.test(String(f.notes || ""));
  if (kind === "room" && strat !== "none" && strat !== "Commercial" && !wantsRooms) return "One room in a shared home, not a whole property";
  const rule = facts.restriction || restrictionIn(text, f, l.mode);
  if (rule) return `Advert rules it out: "${rule.slice(0, 80)}"`;
  if (facts.inArea === false) return "Outside the area you asked for";
  const area = outsideArea(l, f, text);
  if (area) return area;
  // Planning searches keep only property with a planning angle. This uses what the AI read on the advert page;
  // a scraped page can leave out the description, so text alone is never enough to rule a listing out.
  if (strat === "Planning" && facts.planning) {
    if (facts.planning === "none") return "No planning permission or development potential in the advert";
    if (f.planning === "granted" && facts.planning !== "granted") return "Planning permission isn't granted in the advert";
  }
  return "";
}
