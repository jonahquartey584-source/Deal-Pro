import { getStore } from "@netlify/blobs";

// Referrals. Each member has a code and two links, one per offer. When a friend who signed up through a
// link buys their first upgraded membership, both of them get the offer the link carried:
//   half3  - 3 months at half price
//   free10 - 10 days free
// Rewards on a Stripe subscription are applied through the Stripe API (STRIPE_SECRET_KEY); without it they
// wait in the admin list to be applied by hand. Members not paying through Stripe get free days directly.

export const OFFERS = {
  half3: { name: "3 months half price", short: "3 months half price" },
  free10: { name: "10 days free", short: "10 days free" },
} as const;
export type Offer = keyof typeof OFFERS;
export const isOffer = (v: unknown): v is Offer => v === "half3" || v === "free10";

export const accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });
const COUPON_ID = "dealpro-referral-half-3-months";
const PAID = ["Lite", "Pro", "Max5", "Max20"];

// Who did what, one record per referred friend.
export type RewardStatus = "waiting" | "applied" | "manual" | "on-upgrade" | "not-needed";
export type Referral = {
  referrerId: string; friendId: string; code: string; offer: Offer; signedUpAt: string; paidAt?: string;
  friend?: { status: RewardStatus; detail: string; at: string };
  referrer?: { status: RewardStatus; detail: string; at: string };
};
export const recordKey = (friendId: string) => `referrals/all/${friendId}`;

// Codes are short, easy to read aloud, and never reused.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export async function codeFor(userId: string, state: Record<string, unknown>, name?: string) {
  if (typeof state.refCode === "string" && state.refCode) return state.refCode;
  const stem = String(name || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5) || "DEAL";
  for (let i = 0; i < 20; i++) {
    const tail = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => ALPHABET[b % ALPHABET.length]).join("");
    const code = `${stem}${tail}`;
    if (!(await accounts().get(`referrals/codes/${code}`))) {
      await accounts().setJSON(`referrals/codes/${code}`, { userId });
      state.refCode = code;
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
      return { status: "manual", detail: offer === "half3"
        ? `In Stripe, add a 50% off coupon for 3 months to subscription ${sub}.`
        : `In Stripe, move the next payment date of subscription ${sub} back by 10 days.` };
    }
    try {
      if (offer === "half3") {
        await ensureCoupon();
        await stripe(`subscriptions/${sub}`, { "discounts[0][coupon]": COUPON_ID });
        return { status: "applied", detail: `50% off the next 3 monthly payments (subscription ${sub}).` };
      }
      const s = await stripe(`subscriptions/${sub}`);
      const from = Math.max(Number(s.trial_end) || 0, Number(s.current_period_end ?? s.items?.data?.[0]?.current_period_end) || 0, Math.floor(Date.now() / 1000));
      const until = from + 10 * 86400;
      await stripe(`subscriptions/${sub}`, { trial_end: String(until), proration_behavior: "none" });
      return { status: "applied", detail: `Next payment moved back 10 days, to ${new Date(until * 1000).toLocaleDateString("en-GB")}.` };
    } catch (e) {
      return { status: "manual", detail: `Stripe didn't accept it (${(e as Error).message}). Apply it by hand in Stripe for subscription ${sub}.` };
    }
  }

  // Not paying through Stripe: free days go on directly; half price waits for their first upgrade.
  if (offer === "free10") {
    if (PAID.includes(state.plan) && !state.planExpiresAt) return { status: "not-needed", detail: "Already has a membership with no end date." };
    const base = PAID.includes(state.plan) && state.planExpiresAt ? Math.max(Date.parse(state.planExpiresAt) || 0, Date.now()) : Date.now();
    if (!PAID.includes(state.plan)) state.plan = "Pro";
    state.planExpiresAt = new Date(base + 10 * 86_400_000).toISOString();
    await save();
    return { status: "applied", detail: `Premium until ${new Date(state.planExpiresAt).toLocaleDateString("en-GB")}.` };
  }
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
      if (rec.referrerId === userId && rec.referrer?.status === "on-upgrade") { rec.referrer = { status: r.status, detail: r.detail, at: now }; changed = true; }
      if (rec.friendId === userId && rec.friend?.status === "on-upgrade") { rec.friend = { status: r.status, detail: r.detail, at: now }; changed = true; }
      if (changed) await accounts().setJSON(b.key, rec);
    }
  }

  // Their first upgrade after signing up through a referral link rewards them both, once.
  const rec = await accounts().get(recordKey(userId), { type: "json" }) as Referral | null;
  if (!rec || rec.paidAt) return;
  rec.paidAt = now;
  await accounts().setJSON(recordKey(userId), rec);
  const friend = await applyReward(userId, rec.offer, { justPaid: true });
  const referrer = await applyReward(rec.referrerId, rec.offer);
  rec.friend = { ...friend, at: now };
  rec.referrer = { ...referrer, at: now };
  await accounts().setJSON(recordKey(userId), rec);
}
