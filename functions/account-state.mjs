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

// netlify/functions/account-state.mts
var json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" }
});
var ADMIN_EMAIL = "jonahquartey584@gmail.com";
var defaultState = (admin = false) => ({
  plan: admin ? "Max20" : "Free",
  admin,
  accountEnabled: true,
  deal: {
    id: `d${Date.now()}`,
    name: "New deal",
    area: "",
    strat: "R2SA",
    london: false,
    status: "Checking",
    units: [{ label: "Unit 1", rent: 0, dep: 0, rate: 0 }],
    a: { fee: 15, clean: 45, stay: 3, other: 150 },
    dd: [],
    ai: false,
    pack: { biz: "", redress: "", fee: "", nda: true, final: false },
    send: { co: "", email: "", addr: "", ll: "", role: "Owner / landlord", phone: "", lemail: "", use: "Serviced accommodation", docs: "" }
  },
  saved: [],
  usage: { sStart: null, sUsed: 0, wStart: null, wUsed: 0 },
  extra: { on: false, cap: 20, spent: 0, month: null },
  analysedDealIds: [],
  unlocked: [],
  agreements: []
});
var account_state_default = async (request, _context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  const key = `users/${user.id}/state`;
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  if (request.method === "GET") {
    let state = await store.get(key, { type: "json" });
    if (!state) {
      state = defaultState(isAdmin);
      await store.setJSON(key, state, { metadata: { userId: user.id, email: user.email ?? "", updatedAt: (/* @__PURE__ */ new Date()).toISOString() } });
    }
    if (state.accountEnabled === false && !isAdmin) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
    if (isAdmin) {
      state.admin = true;
      state.plan = "Max20";
      state.accountEnabled = true;
    }
    return json({ user: { id: user.id, email: user.email, name: user.name }, state });
  }
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.state !== "object" || body.state === null) {
      return json({ error: "A valid account state is required." }, 400);
    }
    const encoded = JSON.stringify(body.state);
    if (encoded.length > 1e6) return json({ error: "Account data is too large." }, 413);
    const nextState = body.state;
    if (isAdmin) {
      nextState.admin = true;
      nextState.plan = "Max20";
      nextState.accountEnabled = true;
    } else {
      const stored = await store.get(key, { type: "json" }) || defaultState(false);
      if (stored.accountEnabled === false) return json({ error: "This account has been suspended. Contact Deal Pro support." }, 403);
      nextState.admin = false;
      nextState.plan = stored.plan || "Free";
      nextState.accountEnabled = true;
      nextState.unlocked = Array.isArray(stored.unlocked) ? stored.unlocked : [];
      if (stored.stripe) nextState.stripe = stored.stripe;
      else delete nextState.stripe;
    }
    await store.setJSON(key, nextState, {
      metadata: { userId: user.id, email: user.email ?? "", updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
    return json({ saved: true });
  }
  return json({ error: "Method not allowed." }, 405);
};
var config = {
  path: "/api/account-state",
  method: ["GET", "PUT"]
};
export {
  config,
  account_state_default as default
};
