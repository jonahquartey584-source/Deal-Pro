import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// downloads/local-src/blobs-shim.mjs
import fs from "node:fs";
import path from "node:path";
var ROOT = path.resolve(process.env.DEALPRO_DATA || "local-data");
var enc = (k) => encodeURIComponent(k).replace(/\./g, "%2E");
function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const f = (k) => path.join(dir, enc(k));
  const readMeta = (k) => {
    try {
      return JSON.parse(fs.readFileSync(f(k) + ".meta", "utf8"));
    } catch {
      return {};
    }
  };
  const raw = (k) => {
    try {
      return fs.readFileSync(f(k));
    } catch {
      return null;
    }
  };
  const out = (buf, type) => buf == null ? null : type === "json" ? JSON.parse(buf.toString("utf8")) : type === "arrayBuffer" ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf.toString("utf8");
  const put = (k, v, o) => {
    fs.writeFileSync(f(k), typeof v === "string" || Buffer.isBuffer(v) ? v : v instanceof ArrayBuffer ? Buffer.from(v) : ArrayBuffer.isView(v) ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : String(v));
    fs.writeFileSync(f(k) + ".meta", JSON.stringify(o?.metadata || {}));
  };
  return {
    async get(k, o) {
      return out(raw(k), o?.type);
    },
    async getWithMetadata(k, o) {
      const b = raw(k);
      return b == null ? null : { data: out(b, o?.type), metadata: readMeta(k), etag: "local" };
    },
    async getMetadata(k) {
      return raw(k) == null ? null : { metadata: readMeta(k), etag: "local" };
    },
    async set(k, v, o) {
      put(k, v, o);
      return { modified: true };
    },
    async setJSON(k, v, o) {
      put(k, JSON.stringify(v), o);
      return { modified: true };
    },
    async delete(k) {
      for (const p of [f(k), f(k) + ".meta"]) try {
        fs.unlinkSync(p);
      } catch {
      }
    },
    async list(o) {
      const prefix = o?.prefix || "";
      const blobs = fs.readdirSync(dir).filter((n) => !n.endsWith(".meta")).map((n) => decodeURIComponent(n)).filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: "local" }));
      return { blobs, directories: [] };
    }
  };
}

// netlify/functions/stripe-webhook.mts
var DEFAULT_PLAN_AMOUNTS = { "999": "Lite", "3900": "Pro", "10000": "Max5", "20000": "Max20" };
function planForAmount(amount) {
  return planAmounts()[String(amount)];
}
var PLANS = ["Lite", "Pro", "Max5", "Max20"];
var TOLERANCE_SECONDS = 300;
var accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });
async function verify(payload, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)));
  const signatures = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1e3 - timestamp) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((sig) => sig.length === expected.length && timingSafeEqual(sig, expected));
}
function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function planAmounts() {
  try {
    return process.env.STRIPE_PLAN_AMOUNTS ? JSON.parse(process.env.STRIPE_PLAN_AMOUNTS) : DEFAULT_PLAN_AMOUNTS;
  } catch {
    console.error("STRIPE_PLAN_AMOUNTS is not valid JSON; using defaults");
    return DEFAULT_PLAN_AMOUNTS;
  }
}
async function setPlan(userId, plan, stripe) {
  const store = accounts();
  const key = `users/${userId}/state`;
  const state = await store.get(key, { type: "json" }) || { plan: "Free", saved: [] };
  const meta = (await store.getMetadata(key))?.metadata || {};
  state.plan = plan;
  state.stripe = { ...state.stripe || {}, ...stripe, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await store.setJSON(key, state, { metadata: { ...meta, userId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } });
}
var stripe_webhook_default = async (request, _context) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }
  const payload = await request.text();
  if (!await verify(payload, request.headers.get("stripe-signature"), secret)) {
    return new Response("Invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  const obj = event.data.object;
  const store = accounts();
  if (event.type === "checkout.session.completed") {
    const userId = String(obj.client_reference_id || "");
    if (!/^[a-zA-Z0-9-]+$/.test(userId)) {
      console.warn("Checkout without a Deal Pro user id; set the plan manually", obj.id, obj.customer_details?.email);
      return new Response("ok");
    }
    if (obj.payment_status !== "paid" && obj.payment_status !== "no_payment_required") return new Response("ok");
    const plan = planForAmount(Number(obj.amount_subtotal ?? obj.amount_total));
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
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated" && ["canceled", "unpaid", "incomplete_expired"].includes(obj.status)) {
    const customer = String(obj.customer || "");
    const link = await store.get(`stripe/customers/${customer}`, { type: "json" });
    if (link?.userId) await setPlan(link.userId, "Free", { subscription: obj.id, endedAt: (/* @__PURE__ */ new Date()).toISOString() });
    else console.warn("Subscription ended for an unknown customer", customer);
    return new Response("ok");
  }
  if (event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status)) {
    const customer = String(obj.customer || "");
    const link = await store.get(`stripe/customers/${customer}`, { type: "json" });
    const item = obj.items?.data?.[0];
    const plan = planForAmount(Number(item?.price?.unit_amount ?? item?.plan?.amount) * (Number(item?.quantity) || 1));
    if (link?.userId && plan && PLANS.includes(plan)) await setPlan(link.userId, plan, { customer, subscription: obj.id });
    else if (!plan) console.warn("Subscription updated with an unrecognised price", obj.id);
    return new Response("ok");
  }
  return new Response("ok");
};
var config = { path: "/api/stripe-webhook", method: "POST" };
export {
  config,
  stripe_webhook_default as default
};
