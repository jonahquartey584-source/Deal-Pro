import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

// Stripe calls this after checkout and when subscriptions change, so plans update
// without the admin doing it by hand. Needs STRIPE_WEBHOOK_SECRET (whsec_...) in Netlify.
//
// The plan is worked out from the amount actually paid, never from anything the
// browser sent, so nobody can pay for Premium and receive Max. Amounts are in pence;
// override with STRIPE_PLAN_AMOUNTS, e.g. {"3900":"Pro","39600":"Pro","10000":"Max5"}.
const DEFAULT_PLAN_AMOUNTS: Record<string, string> = { "3900": "Pro", "39600": "Pro", "10000": "Max5", "20000": "Max20" };
const PLANS = ["Pro", "Max5", "Max20", "TeamStd", "TeamPrem"];
const TOLERANCE_SECONDS = 300;

const accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });

async function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const signatures = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function planAmounts(): Record<string, string> {
  try {
    return process.env.STRIPE_PLAN_AMOUNTS ? JSON.parse(process.env.STRIPE_PLAN_AMOUNTS) : DEFAULT_PLAN_AMOUNTS;
  } catch {
    console.error("STRIPE_PLAN_AMOUNTS is not valid JSON; using defaults");
    return DEFAULT_PLAN_AMOUNTS;
  }
}

async function setPlan(userId: string, plan: string, stripe: Record<string, unknown>) {
  const store = accounts();
  const key = `users/${userId}/state`;
  const state = (await store.get(key, { type: "json" }) as Record<string, unknown> | null) || { plan: "Free", saved: [] };
  const meta = (await store.getMetadata(key))?.metadata || {};
  state.plan = plan;
  state.stripe = { ...(state.stripe as Record<string, unknown> || {}), ...stripe, updatedAt: new Date().toISOString() };
  await store.setJSON(key, state, { metadata: { ...meta, userId, updatedAt: new Date().toISOString() } });
}

export default async (request: Request, _context: Context) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }
  const payload = await request.text();
  if (!(await verify(payload, request.headers.get("stripe-signature"), secret))) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, any> } };
  const obj = event.data.object;
  const store = accounts();

  if (event.type === "checkout.session.completed") {
    const userId = String(obj.client_reference_id || "");
    if (!/^[a-zA-Z0-9-]+$/.test(userId)) {
      console.warn("Checkout without a Deal Pro user id; set the plan manually", obj.id, obj.customer_details?.email);
      return new Response("ok");
    }
    if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return new Response("ok");
    const plan = planAmounts()[String(obj.amount_subtotal ?? obj.amount_total)];
    if (!plan || !PLANS.includes(plan)) {
      console.warn(`No plan matches amount ${obj.amount_subtotal}; set the plan manually`, obj.id, userId);
      return new Response("ok");
    }
    const customer = typeof obj.customer === "string" ? obj.customer : "";
    const subscription = typeof obj.subscription === "string" ? obj.subscription : "";
    await setPlan(userId, plan, { customer, subscription, checkoutSession: obj.id });
    if (customer) await store.setJSON(`stripe/customers/${customer}`, { userId });
    return new Response("ok");
  }

  if (event.type === "customer.subscription.deleted" || (event.type === "customer.subscription.updated" && ["canceled", "unpaid", "incomplete_expired"].includes(obj.status))) {
    const customer = String(obj.customer || "");
    const link = await store.get(`stripe/customers/${customer}`, { type: "json" }) as { userId?: string } | null;
    if (link?.userId) await setPlan(link.userId, "Free", { subscription: obj.id, endedAt: new Date().toISOString() });
    else console.warn("Subscription ended for an unknown customer", customer);
    return new Response("ok");
  }

  return new Response("ok");
};

export const config: Config = { path: "/api/stripe-webhook", method: "POST" };
