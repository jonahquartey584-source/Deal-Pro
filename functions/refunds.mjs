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

// downloads/local-src/identity-shim.mjs
async function getUser() {
  const als = globalThis.__dpUser;
  if (als) return als.getStore() ?? null;
  return { id: "local-admin", email: "jonahquartey584@gmail.com", name: "Jonah" };
}

// netlify/functions/refunds.mts
var ADMIN_EMAIL = "jonahquartey584@gmail.com";
var REFUND_WINDOW_DAYS = 14;
var json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
var refunds = () => getStore({ name: "deal-refunds", consistency: "strong" });
var accounts = () => getStore({ name: "deal-premium-accounts", consistency: "strong" });
async function stripe(path2, method = "GET", form) {
  const res = await fetch(`https://api.stripe.com/v1/${path2}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : void 0
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}
var pence = (n, currency = "gbp") => `${currency === "gbp" ? "\xA3" : ""}${(n / 100).toFixed(2)}${currency === "gbp" ? "" : ` ${currency.toUpperCase()}`}`;
var refunds_default = async (request, _context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const store = refunds();
  const all = async () => (await Promise.all((await store.list({ prefix: "req/" })).blobs.map((b) => store.get(b.key, { type: "json" })))).filter((r) => !!r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (request.method === "GET") {
    const list = await all();
    if (isAdmin && new URL(request.url).searchParams.get("all")) return json({ requests: list, stripeConnected: !!process.env.STRIPE_SECRET_KEY });
    return json({ requests: list.filter((r) => r.userId === user.id).map(({ stripe: _s, ...r }) => r), windowDays: REFUND_WINDOW_DAYS });
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const reason = String(body?.reason || "").trim().slice(0, 1e3);
    if (reason.length < 5) return json({ error: "Tell us briefly why you'd like a refund." }, 400);
    const state = await accounts().get(`users/${user.id}/state`, { type: "json" });
    const plan = String(state?.plan || "Free");
    if (plan === "Free" && !state?.stripe?.customer) return json({ error: "There's no paid subscription on this account to refund." }, 400);
    const mine = (await all()).filter((r) => r.userId === user.id);
    if (mine.some((r) => r.status === "pending")) return json({ error: "You already have a refund request waiting. We'll be in touch soon." }, 409);
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const req = {
      id,
      userId: user.id,
      email: user.email || "",
      plan,
      reason,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "pending",
      stripe: { customer: state?.stripe?.customer, subscription: state?.stripe?.subscription }
    };
    await store.setJSON(`req/${id}`, req);
    const { stripe: _s, ...visible } = req;
    return json({ request: visible }, 201);
  }
  if (request.method === "PATCH") {
    if (!isAdmin) return json({ error: "Administrator access required." }, 403);
    const body = await request.json().catch(() => null);
    if (!body?.id || !/^[0-9]+-[0-9a-f]{8}$/.test(body.id)) return json({ error: "A valid request is required." }, 400);
    const key = `req/${body.id}`;
    const req = await store.get(key, { type: "json" });
    if (!req) return json({ error: "Request not found." }, 404);
    if (req.status !== "pending") return json({ error: "This request has already been decided." }, 409);
    req.note = String(body.note || "").slice(0, 500);
    req.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (body.action === "decline") {
      req.status = "declined";
      await store.setJSON(key, req);
      return json({ request: req });
    }
    if (body.action !== "approve") return json({ error: "Unknown action." }, 400);
    if (process.env.STRIPE_SECRET_KEY && req.stripe?.customer) {
      try {
        const charges = await stripe(`charges?customer=${encodeURIComponent(req.stripe.customer)}&limit=10`);
        const charge = (charges.data || []).find((c) => c.paid && c.status === "succeeded" && !c.refunded);
        if (!charge) throw new Error("No refundable payment was found for this customer.");
        const refund = await stripe("refunds", "POST", { charge: charge.id, reason: "requested_by_customer" });
        req.stripe = { ...req.stripe, charge: charge.id, refund: refund.id };
        req.amount = pence(refund.amount, refund.currency);
        if (req.stripe.subscription) await stripe(`subscriptions/${encodeURIComponent(req.stripe.subscription)}`, "DELETE").catch((e) => console.warn("Cancel failed", e));
        req.status = "refunded";
      } catch (error) {
        return json({ error: `Stripe refused the refund: ${error.message}` }, 502);
      }
    } else {
      req.status = "approved_manual";
    }
    const stateKey = `users/${req.userId}/state`;
    const state = await accounts().get(stateKey, { type: "json" });
    if (state) {
      const meta = (await accounts().getMetadata(stateKey))?.metadata || {};
      state.plan = "Free";
      await accounts().setJSON(stateKey, state, { metadata: { ...meta, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } });
    }
    await store.setJSON(key, req);
    return json({ request: req });
  }
  return json({ error: "Method not allowed." }, 405);
};
var config = { path: "/api/refunds", method: ["GET", "POST", "PATCH"] };
export {
  config,
  refunds_default as default
};
