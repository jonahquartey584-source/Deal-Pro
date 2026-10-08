// Does an advert really match what the member asked for? The search can return a room in a shared
// house for a whole-property search, an office for a rent-to-rent search, or a property in the
// wrong town. This reads each advert's own title and description and says why one doesn't fit.
// Pure functions with no network, so every rule can be tested.

export type Kind = "whole" | "room" | "commercial" | "unknown";
export type ScreenListing = { site: string; title: string; type: string; beds: number | null; price: number; mode: "rent" | "buy"; area: string; postcode: string };
export type ScreenFilters = { strategy?: string; type?: string; notes?: string; loc?: string };
// What the AI saw when it opened the page itself (all optional).
export type Facts = { kind?: Kind; inArea?: boolean | null; restriction?: string };

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
  const commercialOk = strat === "Commercial" || f.type === "commercial" || /^(?:RightmoveCommercial|Realla|NovaLoca|LoopNet)$/.test(l.site);
  if (kind === "commercial" && !commercialOk) return "Commercial, not a home";
  const wantsRooms = /\b(?:rooms? (?:to rent|in an?)|house\s?share|flat\s?share|single rooms?)\b/i.test(String(f.notes || ""));
  if (kind === "room" && strat !== "none" && strat !== "Commercial" && !wantsRooms) return "One room in a shared home, not a whole property";
  const rule = facts.restriction || restrictionIn(text, f, l.mode);
  if (rule) return `Advert rules it out: "${rule.slice(0, 80)}"`;
  if (facts.inArea === false) return "Outside the area you asked for";
  return outsideArea(l, f, text);
}
