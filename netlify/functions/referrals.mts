import { getUser } from "@netlify/identity";
import type { Config, Context } from "@netlify/functions";
import { applyPlanExpiry } from "../lib/plan.mts";
import { OFFERS, accounts, chooseReward, codeFor, isOffer, ownerOf, recordKey, type Referral, type RewardStatus } from "../lib/referrals.mts";

// GET   /api/referrals            the member's code, the people they referred and any reward to choose
// POST  /api/referrals            {code}: link the signed-in member to whoever referred them
// POST  /api/referrals            {choose: friendId, offer}: pick the reward for a completed referral
// GET   /api/referrals?all=1      admin: every referral
// PATCH /api/referrals            admin: {friendId, side: "friend" | "referrer"} mark a reward as applied by hand

const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const PAID = ["Lite", "Pro", "Max5", "Max20"];
// Shown to the other person: first name and the first letter of the surname only.
const shortName = (s: unknown) => { const p = String(s || "").trim().split(/\s+/).filter(Boolean); return p.length ? `${p[0]}${p[1] ? " " + p[1][0] + "." : ""}` : "A friend"; };
const STATUS_TEXT: Record<RewardStatus, string> = { waiting: "Waiting for them to upgrade", choose: "Choose your reward", applied: "Applied", manual: "Being applied", "on-upgrade": "Applied when you upgrade", "not-needed": "Not needed" };
type Side = { status: RewardStatus; detail: string; at: string; offer?: keyof typeof OFFERS };
const sideView = (x: Side | undefined, paid: boolean) => {
  const status = !paid ? "waiting" : x?.status === "waiting" && x.offer ? "manual" : (x?.status || "choose");
  return { status, text: STATUS_TEXT[status as RewardStatus], offerName: x?.offer ? OFFERS[x.offer].name : null };
};

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
    return json({ stripeConnected: !!process.env.STRIPE_SECRET_KEY, referrals: recs.map((r) => ({ ...r, referrerInfo: people.get(r.referrerId), friendInfo: people.get(r.friendId),
      friendOffer: r.friend?.offer ? OFFERS[r.friend.offer].name : null, referrerOffer: r.referrer?.offer ? OFFERS[r.referrer.offer].name : null })) });
  }

  if (request.method === "PATCH") {
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);
    const body = await request.json().catch(() => null) as { friendId?: string; side?: string } | null;
    if (!body?.friendId || !/^[a-zA-Z0-9-]+$/.test(body.friendId) || (body.side !== "friend" && body.side !== "referrer")) return json({ error: "Unknown referral." }, 400);
    const rec = await store.get(recordKey(body.friendId), { type: "json" }) as Referral | null;
    if (!rec) return json({ error: "Unknown referral." }, 404);
    const side = body.side as "friend" | "referrer";
    rec[side] = { ...rec[side], status: "applied", detail: `${rec[side]?.detail || ""} Marked as applied by hand.`.trim(), at: new Date().toISOString() };
    await store.setJSON(recordKey(body.friendId), rec);
    return json({ ok: true });
  }

  const state = await store.get(key, { type: "json" }) as Record<string, any> | null;
  if (!state) return json({ error: "Account not found. Refresh the page and try again." }, 404);
  applyPlanExpiry(state);

  if (request.method === "POST") {
    const body = await request.json().catch(() => null) as { code?: string; choose?: string; offer?: string } | null;

    // Choosing a reward: the member must be the friend or the referrer on that referral.
    if (body?.choose !== undefined) {
      const friendId = String(body.choose);
      if (!/^[a-zA-Z0-9-]+$/.test(friendId) || !isOffer(body.offer)) return json({ error: "Choose one of the rewards." }, 400);
      const rec = await store.get(recordKey(friendId), { type: "json" }) as Referral | null;
      const side = rec?.friendId === user.id ? "friend" : rec?.referrerId === user.id ? "referrer" : null;
      if (!rec || !side) return json({ error: "Referral not found." }, 404);
      const done = await chooseReward(friendId, side, body.offer);
      if (!done) return json({ error: "This reward has already been chosen, or the referral isn't complete yet." }, 409);
      return json({ ok: true, offerName: OFFERS[body.offer].name, status: done.status, text: STATUS_TEXT[done.status], detail: done.detail });
    }

    const code = String(body?.code || "").toUpperCase().trim();
    if (await store.get(recordKey(user.id))) return json({ ok: true, already: true });
    // Only new members can be referred: not someone who has already paid or been given a plan.
    if (state.stripe?.subscription || PAID.includes(state.plan) || state.admin) return json({ ok: false, reason: "existing" });
    const referrerId = await ownerOf(code);
    if (!referrerId || referrerId === user.id) return json({ ok: false, reason: "invalid" });
    const now = new Date().toISOString();
    const rec: Referral = { referrerId, friendId: user.id, code, signedUpAt: now, friend: { status: "waiting", detail: "", at: now }, referrer: { status: "waiting", detail: "", at: now } };
    await store.setJSON(recordKey(user.id), rec);
    const owner = await store.get(`users/${referrerId}/state`, { type: "json" }) as Record<string, any> | null;
    return json({ ok: true, referrerName: shortName(owner?.profile?.fullName) });
  }

  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const code = await codeFor(user.id, state.profile?.fullName || user.name);
  const { blobs } = await store.list({ prefix: "referrals/all/" });
  const mine: Array<Record<string, unknown>> = [];
  let mineAsFriend: Record<string, unknown> | null = null;
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" }) as Referral | null;
    if (!r) continue;
    if (r.friendId === user.id) {
      const by = await store.get(`users/${r.referrerId}/state`, { type: "json" }) as Record<string, any> | null;
      mineAsFriend = { id: r.friendId, by: shortName(by?.profile?.fullName), paid: !!r.paidAt, ...sideView(r.friend as Side, !!r.paidAt) };
    }
    if (r.referrerId !== user.id) continue;
    const f = await store.get(`users/${r.friendId}/state`, { type: "json" }) as Record<string, any> | null;
    mine.push({ id: r.friendId, name: shortName(f?.profile?.fullName), signedUpAt: r.signedUpAt, paidAt: r.paidAt || null, ...sideView(r.referrer as Side, !!r.paidAt) });
  }
  mine.sort((a, b) => Date.parse(String(b.signedUpAt)) - Date.parse(String(a.signedUpAt)));
  return json({
    code, offers: OFFERS, referrals: mine, referredBy: mineAsFriend,
    pendingDiscount: state.pendingDiscount && !state.pendingDiscount.appliedAt ? OFFERS.half3.name : null,
  });
};

export const config: Config = { path: "/api/referrals", method: ["GET", "POST", "PATCH"] };
