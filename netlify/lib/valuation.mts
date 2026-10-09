// Market value (MV) and how far below it an asking price is (BMV). The AI estimates MV from recent sold
// prices of similar homes nearby; these helpers keep that estimate honest. Pure functions, easy to test.

export type MV = { value: number; low: number; high: number; comps: number; basis: string; confidence: "high" | "medium" | "low" };

// Percent below market value: positive means the asking price is under the estimated MV.
export const bmvPct = (price: number, mv?: { value: number } | null): number | null =>
  mv && mv.value > 0 && price > 0 ? Math.round(((mv.value - price) / mv.value) * 1000) / 10 : null;

// Reads one valuation the AI returned for a listing. Anything that can't be right is dropped rather than shown:
// no value, or a value more than 2.5x or under 0.4x the asking price (a mismatch is likelier than a miracle deal).
export function readValue(price: number, c: Record<string, unknown>): MV | null {
  const value = Math.round(Number(c.value));
  if (!Number.isFinite(value) || value <= 0 || !(price > 0)) return null;
  if (value > price * 2.5 || value < price * 0.4) return null;
  const num = (x: unknown, fallback: number) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n > 0 ? n : fallback; };
  let low = num(c.low, Math.round(value * 0.9)), high = num(c.high, Math.round(value * 1.1));
  if (low > value) low = value;
  if (high < value) high = value;
  const comps = Math.max(0, Math.min(50, Math.round(Number(c.comps) || 0)));
  // No comparable sales behind it means no evidence, so it is not shown as a value at all.
  if (comps === 0) return null;
  const said = c.confidence === "high" || c.confidence === "medium" ? c.confidence : "low";
  // Thin evidence (fewer than 3 sales) caps confidence at medium.
  const confidence: MV["confidence"] = comps < 3 && said === "high" ? "medium" : said;
  return { value, low, high, comps, basis: String(c.basis || "").replace(/\s+/g, " ").slice(0, 220), confidence };
}
