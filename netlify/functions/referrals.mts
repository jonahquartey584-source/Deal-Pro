import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { applyPlanExpiry } from "../lib/plan.mts";
import { OFFERS, accounts, codeFor, isOffer, ownerOf, recordKey, type Referral, type RewardStatus } from "../lib/referrals.mts";

// GET   /api/referrals            the member's code, links and the people they referred
// POST  /api/referrals            {code, offer}: link the signed-in member to whoever referred them
// GET   /api/referrals?all=1      admin: every referral
// PATCH /api/referrals            admin: {friendId, side: "friend" | "referrer"} mark a reward as applied by hand

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const PAID = ["Lite", "Pro", "Max5", "Max20"];
// Shown to the referrer: their friend's first name and the first letter of their surname only.
const shortName = (s: unknown) => { const p = String(s || "").trim().split(/\s+/).filter(Boolean); return p.length ? `${p[0]}${p[1] ? " " + p[1][0] + "." : ""}` : "A friend"; };
const STATUS_TEXT: Record<RewardStatus, string> = { waiting: "Waiting for them to upgrade", applied: "Applied", manual: "Being applied", "on-upgrade": "Applied when you upgrade", "not-needed": "Not needed" };

export default async (request: Request, _context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = accounts();
  const url = new URL(request.url);
  const key = `users/${user.id}/state`;

  if (request.method === "GET" && url.searchParams.get("all")) {
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);
    const { blobs } = await store.list({ prefix: "referrals/all/" });
    const recs = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Referral | null>))).filter(Boolean) as Referral[];
    const who = async (id: string) => {
      const [st, meta] = await Promise.all([store.get(`users/${id}/state`, { type: "json" }) as Promise<Record<string, any> | null>, store.getMetadata(`users/${id}/state`)]);
      const m = (meta?.metadata || {}) as Record<string, unknown>;
      return { id, name: String(st?.profile?.fullName || m.name || ""), email: String(m.email || ""), plan: String(st?.plan || "Free") };
    };
    const people = new Map<string, Awaited<ReturnType<typeof who>>>();
    for (const id of new Set(recs.flatMap((r) => [r.referrerId, r.friendId]))) people.set(id, await who(id));
    recs.sort((a, b) => Date.parse(b.signedUpAt) - Date.parse(a.signedUpAt));
    return json({ stripeConnected: !!process.env.STRIPE_SECRET_KEY, referrals: recs.map((r) => ({ ...r, referrerInfo: people.get(r.referrerId), friendInfo: people.get(r.friendId), offerName: OFFERS[r.offer].name })) });
  }

  if (request.method === "PATCH") {
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);
    const body = await request.json().catch(() => null) as { friendId?: string; side?: string } | null;
    if (!body?.friendId || !/^[a-zA-Z0-9-]+$/.test(body.friendId) || (body.side !== "friend" && body.side !== "referrer")) return json({ error: "Unknown referral." }, 400);
    const rec = await store.get(recordKey(body.friendId), { type: "json" }) as Referral | null;
    if (!rec) return json({ error: "Unknown referral." }, 404);
    const side = body.side as "friend" | "referrer";
    rec[side] = { status: "applied", detail: `${rec[side]?.detail || ""} Marked as applied by hand.`.trim(), at: new Date().toISOString() };
    await store.setJSON(recordKey(body.friendId), rec);
    return json({ ok: true });
  }

  const state = await store.get(key, { type: "json" }) as Record<string, any> | null;
  if (!state) return json({ error: "Account not found. Refresh the page and try again." }, 404);
  applyPlanExpiry(state);

  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { code?: string; offer?: string } | null;
    const code = String(body?.code || "").toUpperCase().trim();
    const offer = body?.offer;
    if (!isOffer(offer)) return json({ error: "Unknown offer." }, 400);
    if (state.referredBy) return json({ ok: true, already: true });
    // Only new members can be referred: not someone who has already paid or been given a plan.
    if (state.stripe?.subscription || PAID.includes(state.plan) || state.admin) return json({ ok: false, reason: "existing" });
    const referrerId = await ownerOf(code);
    if (!referrerId || referrerId === user.id) return json({ ok: false, reason: "invalid" });
    const now = new Date().toISOString();
    state.referredBy = { userId: referrerId, code, offer, at: now };
    const meta = (await store.getMetadata(key))?.metadata || {};
    await store.setJSON(key, state, { metadata: { ...meta, updatedAt: now } });
    const rec: Referral = { referrerId, friendId: user.id, code, offer, signedUpAt: now, friend: { status: "waiting", detail: "", at: now }, referrer: { status: "waiting", detail: "", at: now } };
    await store.setJSON(recordKey(user.id), rec);
    const owner = await store.get(`users/${referrerId}/state`, { type: "json" }) as Record<string, any> | null;
    return json({ ok: true, offer, offerName: OFFERS[offer].name, referrerName: shortName(owner?.profile?.fullName) });
  }

  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const hadCode = !!state.refCode;
  const code = await codeFor(user.id, state, state.profile?.fullName || user.name);
  if (!hadCode) {
    const meta = (await store.getMetadata(key))?.metadata || {};
    await store.setJSON(key, state, { metadata: { ...meta, updatedAt: String(meta.updatedAt || new Date().toISOString()) } });
  }
  const { blobs } = await store.list({ prefix: "referrals/all/" });
  const mine: Array<Record<string, unknown>> = [];
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" }) as Referral | null;
    if (!r || r.referrerId !== user.id) continue;
    const f = await store.get(`users/${r.friendId}/state`, { type: "json" }) as Record<string, any> | null;
    mine.push({ name: shortName(f?.profile?.fullName), offer: r.offer, offerName: OFFERS[r.offer].name, signedUpAt: r.signedUpAt, paidAt: r.paidAt || null,
      reward: r.paidAt ? STATUS_TEXT[r.referrer?.status || "waiting"] : STATUS_TEXT.waiting });
  }
  mine.sort((a, b) => Date.parse(String(b.signedUpAt)) - Date.parse(String(a.signedUpAt)));
  return json({
    code, offers: OFFERS, referrals: mine,
    referredBy: state.referredBy ? { offer: state.referredBy.offer, offerName: OFFERS[state.referredBy.offer as keyof typeof OFFERS]?.name || "" } : null,
    pendingDiscount: state.pendingDiscount && !state.pendingDiscount.appliedAt ? OFFERS.half3.name : null,
  });
};

export const config: Config = { path: "/api/referrals", method: ["GET", "POST", "PATCH"] };
