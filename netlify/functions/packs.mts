import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { applyPlanExpiry } from "../lib/plan.mts";
import { accounts, ADMIN_EMAIL } from "../lib/ai.mts";

// Shareable deal packs. Premium and Max members create them from Deal Finder ("Analyse & package"),
// and anyone with the link can open the pack at /pack/<id>. Packs are pre-NDA summaries: the browser
// leaves out the listing link, exact address and advertiser, and this function keeps only the known
// fields, as plain text, so a pack can't carry anything else.

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const PACK_PLANS = new Set(["Pro", "Max5", "Max20"]);
const store = () => getStore({ name: "deal-packs", consistency: "strong" });

const str = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, n);
const list = (v: unknown, n: number, len = 240) => (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, n);
const pairs = (v: unknown, n: number) => (Array.isArray(v) ? v : [])
  .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
  .map((x) => ({ label: str(x.label, 80), value: str(x.value, 80) })).filter((x) => x.label && x.value).slice(0, n);
const photos = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => str(x, 600)).filter((u) => /^https:\/\/[^\s"'<>]+$/.test(u)).slice(0, 8);

function clean(p: Record<string, unknown>) {
  const score = Number(p.score);
  return {
    title: str(p.title, 120) || "Property deal",
    location: str(p.location, 120),
    strategy: str(p.strategy, 60),
    headline: str(p.headline, 80),
    facts: pairs(p.facts, 8),
    verdict: str(p.verdict, 80),
    ...(Number.isFinite(score) ? { score: Math.max(0, Math.min(100, Math.round(score))) } : {}),
    summary: str(p.summary, 900),
    metrics: pairs(p.metrics, 12),
    scenarios: pairs(p.scenarios, 6),
    risks: list(p.risks, 6),
    photos: photos(p.photos),
    biz: str(p.biz, 120),
    redress: str(p.redress, 80),
    fee: str(p.fee, 80),
    contact: str(p.contact, 160),
  };
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  // Public: anyone with the link can read a pack.
  if (request.method === "GET") {
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "This deal pack doesn't exist." }, 404);
    const pack = await store().get(`packs/${id}`, { type: "json" }) as Record<string, unknown> | null;
    if (!pack || pack.removed) return json({ error: "This deal pack is no longer available." }, 404);
    const { owner: _owner, ...pub } = pack;
    return json({ pack: pub });
  }

  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const state = await accounts().get(`users/${user.id}/state`, { type: "json" }) as Record<string, unknown> | null;
  applyPlanExpiry(state);
  if (!isAdmin && state?.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);

  if (request.method === "DELETE") {
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Unknown deal pack." }, 404);
    const pack = await store().get(`packs/${id}`, { type: "json" }) as Record<string, unknown> | null;
    if (!pack || (pack.owner !== user.id && !isAdmin)) return json({ error: "Unknown deal pack." }, 404);
    await store().delete(`packs/${id}`);
    return json({ ok: true });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!isAdmin && !PACK_PLANS.has(String(state?.plan || "Free"))) {
    return json({ error: "Analyse & package is included with Premium and Max. Upgrade to create shareable deal packs." }, 402);
  }
  const body = await request.json().catch(() => null) as { pack?: unknown } | null;
  if (!body || !body.pack || typeof body.pack !== "object") return json({ error: "Nothing to package." }, 400);
  if (JSON.stringify(body.pack).length > 60_000) return json({ error: "This deal pack is too large." }, 413);

  const packId = crypto.randomUUID();
  await store().setJSON(`packs/${packId}`, { ...clean(body.pack as Record<string, unknown>), owner: user.id, createdAt: new Date().toISOString() });
  return json({ id: packId, url: `/pack/${packId}` });
};

export const config: Config = {
  path: "/api/packs",
  method: ["GET", "POST", "DELETE"],
};
