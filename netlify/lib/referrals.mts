import { getStore } from "@netlify/blobs";

// Referrals. Each member has a code and one link. When a friend who signed up through it buys their first
// upgraded membership, the referral is complete and each of them claims a reward from OFFERS (for now,
// 3 months at half price; add more entries to OFFERS to offer a choice).
// Rewards on a Stripe subscription are applied through the Stripe API (STRIPE_SECRET_KEY); without it they
// wait in the admin list to be applied by hand. Members not paying through Stripe get free days directly.

export const OFFERS = {
  half3: { name: "3 months half price", short: "3 months half price" },
} as const;
export type Offer = keyof typeof OFFERS;
export const isOffer = (v: unknown): v is Offer => typeof v === "string" && v in OFFERS;

export const accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });
const COUPON_ID = "dealpro-referral-half-3-months";
const PAID = ["Lite", "Pro", "Max5", "Max20"];

// Who did what, one record per referred friend.
export type RewardStatus = "waiting" | "choose" | "applied" | "manual" | "on-upgrade" | "not-needed";
export type Referral = {
  referrerId: string; friendId: string; code: string; signedUpAt: string; paidAt?: string;
  // Each side's reward: "waiting" until the friend upgrades, then "choose" until they pick an offer.
  friend?: { status: RewardStatus; detail: string; at: string; offer?: Offer };
  referrer?: { status: RewardStatus; detail: string; at: string; offer?: Offer };
};
export const recordKey = (friendId: string) => `referrals/all/${friendId}`;

// Codes are short, easy to read aloud, and never reused.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Kept apart from the account, so making a code never changes the account copy the browser compares on load.
export async function codeFor(userId: string, name?: string) {
  const have = await accounts().get(`referrals/users/${userId}`, { type: "json" }) as { code?: string } | null;
  if (have?.code) return have.code;
  const stem = String(name || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5) || "DEAL";
  for (let i = 0; i < 20; i++) {
    const tail = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => ALPHABET[b % ALPHABET.length]).join("");
    const code = `${stem}${tail}`;
    if (!(await accounts().get(`referrals/codes/${code}`))) {
      await accounts().setJSON(`referrals/codes/${code}`, { userId });
      await accounts().setJSON(`referrals/users/${userId}`, { code });
      return code;
    }
  }
  throw new Error("Couldn't make a referral code");
}
export async function ownerOf(code: string) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
  const x = await accounts().get(`referrals/codes/${code}`, { type: "json" }) as { userId?: string } | null;
  return x?.userId || null;
}

async function stripe(path: string, body?: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("no-key");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const j = await r.json().catch(() => ({})) as Record<string, any>;
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Stripe ${r.status}`), { status: r.status, code: j?.error?.code });
  return j;
}
async function ensureCoupon() {
  try { await stripe(`coupons/${COUPON_ID}`); }
  catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
    await stripe("coupons", { id: COUPON_ID, percent_off: "50", duration: "repeating", duration_in_months: "3", name: "Referral: 3 months half price" });
  }
}

// Gives one person their reward. Returns how it went, for the record and the admin list.
export async function applyReward(userId: string, offer: Offer, opts: { justPaid?: boolean } = {}): Promise<{ status: RewardStatus; detail: string }> {
  const key = `users/${userId}/state`;
  const state = await accounts().get(key, { type: "json" }) as Record<string, any> | null;
  if (!state) return { status: "manual", detail: "Account not found. Apply the reward by hand." };
  const sub = state.stripe?.subscription && PAID.includes(state.plan) ? String(state.stripe.subscription) : "";
  const save = async () => {
    const meta = (await accounts().getMetadata(key))?.metadata || {};
    await accounts().setJSON(key, state, { metadata: { ...meta, updatedAt: new Date().toISOString() } });
  };

  if (sub) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return { status: "manual", detail: `In Stripe, add a 50% off coupon for 3 months to subscription ${sub}.` };
    }
    try {
      await ensureCoupon();
      await stripe(`subscriptions/${sub}`, { "discounts[0][coupon]": COUPON_ID });
      return { status: "applied", detail: `50% off the next 3 monthly payments (subscription ${sub}).` };
    } catch (e) {
      return { status: "manual", detail: `Stripe didn't accept it (${(e as Error).message}). Apply it by hand in Stripe for subscription ${sub}.` };
    }
  }

  // Not paying through Stripe: half price waits for their first paid upgrade.
  void offer;
  if (opts.justPaid) return { status: "manual", detail: "Paid without a Stripe subscription on record. Apply 50% off for 3 months by hand." };
  state.pendingDiscount = { offer: "half3", at: new Date().toISOString() };
  await save();
  return { status: "on-upgrade", detail: "50% off for 3 months, applied when they upgrade." };
}

// Called by the Stripe webhook after a member's plan is set from a payment.
export async function onPaidUpgrade(userId: string) {
  const state = await accounts().get(`users/${userId}/state`, { type: "json" }) as Record<string, any> | null;
  if (!state) return;
  const now = new Date().toISOString();

  // A half-price reward they earned while on Free: apply it to the subscription they just started.
  if (state.pendingDiscount?.offer === "half3" && !state.pendingDiscount.appliedAt) {
    const r = await applyReward(userId, "half3", { justPaid: true });
    const fresh = await accounts().get(`users/${userId}/state`, { type: "json" }) as Record<string, any>;
    fresh.pendingDiscount = { ...state.pendingDiscount, appliedAt: now, status: r.status, detail: r.detail };
    await accounts().setJSON(`users/${userId}/state`, fresh, { metadata: { ...((await accounts().getMetadata(`users/${userId}/state`))?.metadata || {}), updatedAt: now } });
    // Update the referral records that were waiting on this upgrade.
    const { blobs } = await accounts().list({ prefix: "referrals/all/" });
    for (const b of blobs) {
      const rec = await accounts().get(b.key, { type: "json" }) as Referral | null;
      if (!rec) continue;
      let changed = false;
      if (rec.referrerId === userId && rec.referrer?.status === "on-upgrade") { rec.referrer = { ...rec.referrer, status: r.status, detail: r.detail, at: now }; changed = true; }
      if (rec.friendId === userId && rec.friend?.status === "on-upgrade") { rec.friend = { ...rec.friend, status: r.status, detail: r.detail, at: now }; changed = true; }
      if (changed) await accounts().setJSON(b.key, rec);
    }
  }

  // Their first upgrade after signing up through a referral link completes it: both can now choose a reward.
  const rec = await accounts().get(recordKey(userId), { type: "json" }) as Referral | null;
  if (!rec || rec.paidAt) return;
  rec.paidAt = now;
  rec.friend = { status: "choose", detail: "", at: now };
  rec.referrer = { status: "choose", detail: "", at: now };
  await accounts().setJSON(recordKey(userId), rec);
}

// A member picks their reward for a completed referral. Each side chooses once.
export async function chooseReward(friendId: string, side: "friend" | "referrer", offer: Offer) {
  const rec = await accounts().get(recordKey(friendId), { type: "json" }) as Referral | null;
  if (!rec || !rec.paidAt || rec[side]?.status !== "choose") return null;
  const now = new Date().toISOString();
  // Mark the choice first, so a double click can't apply it twice.
  rec[side] = { status: "waiting", detail: "Applying…", at: now, offer };
  await accounts().setJSON(recordKey(friendId), rec);
  const r = await applyReward(side === "friend" ? friendId : rec.referrerId, offer);
  rec[side] = { ...r, at: now, offer };
  await accounts().setJSON(recordKey(friendId), rec);
  return rec[side];
}
