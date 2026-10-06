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

// netlify/functions/admin-accounts.mts
var ADMIN_EMAIL = "jonahquartey584@gmail.com";
var json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
var admin_accounts_default = async (request, _context) => {
  const user = await getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) return json({ error: "Administrator access required." }, 403);
  const store = getStore({ name: "deal-premium-accounts", consistency: "strong" });
  if (request.method === "GET") {
    const { blobs } = await store.list({ prefix: "users/" });
    const accounts = await Promise.all(blobs.filter((b) => b.key.endsWith("/state")).map(async (blob) => {
      const state = await store.get(blob.key, { type: "json" });
      const metadata = (await store.getMetadata(blob.key))?.metadata;
      return {
        userId: blob.key.split("/")[1],
        email: metadata?.email || "Email unavailable",
        plan: state?.plan || "Free",
        enabled: state?.accountEnabled !== false,
        savedDeals: Array.isArray(state?.saved) ? state.saved.length : 0,
        updatedAt: metadata?.updatedAt || null
      };
    }));
    return json({ accounts });
  }
  const body = await request.json().catch(() => null);
  if (!body?.userId || !/^[a-zA-Z0-9-]+$/.test(body.userId)) return json({ error: "A valid user is required." }, 400);
  const key = `users/${body.userId}/state`;
  if (request.method === "PATCH") {
    const state = await store.get(key, { type: "json" });
    if (!state) return json({ error: "Account data was not found." }, 404);
    if (body.plan && ["Free", "Lite", "Pro", "Max5", "Max20"].includes(body.plan)) state.plan = body.plan;
    if (typeof body.enabled === "boolean") state.accountEnabled = body.enabled;
    const oldMeta = (await store.getMetadata(key))?.metadata;
    await store.setJSON(key, state, { metadata: { ...oldMeta || {}, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } });
    return json({ saved: true });
  }
  if (request.method === "DELETE") {
    if (body.userId === user.id) return json({ error: "You cannot delete your own administrator account." }, 400);
    await store.delete(key);
    return json({ deleted: true });
  }
  return json({ error: "Method not allowed." }, 405);
};
var config = { path: "/api/admin/accounts", method: ["GET", "PATCH", "DELETE"] };
export {
  config,
  admin_accounts_default as default
};
