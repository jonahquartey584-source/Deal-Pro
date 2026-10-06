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

// netlify/functions/history.mts
var json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" }
});
var KINDS = { finder: { keep: 30 }, analyser: { keep: 50 } };
var MAX_ENTRY = 2e6;
var clip = (v, n) => String(v ?? "").slice(0, n);
var history_default = async (request, _context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to see your history." }, 401);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (!(kind in KINDS)) return json({ error: "Unknown history." }, 400);
  const store = getStore({ name: "deal-history", consistency: "strong" });
  const base = `users/${user.id}/${kind}`;
  const loadIndex = async () => await store.get(`${base}/index`, { type: "json" }) || [];
  const id = url.searchParams.get("id");
  if (id !== null && !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Unknown entry." }, 404);
  if (request.method === "GET") {
    if (!id) return json({ items: await loadIndex() });
    const entry = await store.get(`${base}/${id}`, { type: "json" });
    if (!entry) return json({ error: "This entry is no longer available." }, 404);
    return json({ entry });
  }
  if (request.method === "DELETE") {
    if (!id) return json({ error: "Unknown entry." }, 404);
    await store.delete(`${base}/${id}`);
    const items2 = (await loadIndex()).filter((x) => x.id !== id);
    await store.setJSON(`${base}/index`, items2);
    return json({ items: items2 });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.data !== "object" || body.data === null) return json({ error: "Nothing to save." }, 400);
  const encoded = JSON.stringify(body.data);
  if (encoded.length > MAX_ENTRY) return json({ error: "This result is too large to save." }, 413);
  const s = body.summary || {};
  const summary = {
    id: crypto.randomUUID(),
    at: (/* @__PURE__ */ new Date()).toISOString(),
    title: clip(s.title, 140) || (kind === "finder" ? "Search" : "Analysis"),
    detail: clip(s.detail, 240),
    ...Number.isFinite(s.count) ? { count: Math.max(0, Math.round(Number(s.count))) } : {},
    ...Number.isFinite(s.score) ? { score: Math.max(0, Math.min(100, Math.round(Number(s.score)))) } : {}
  };
  await store.set(`${base}/${summary.id}`, encoded);
  const items = [summary, ...await loadIndex()];
  const drop = items.splice(KINDS[kind].keep);
  await store.setJSON(`${base}/index`, items);
  await Promise.all(drop.map((x) => store.delete(`${base}/${x.id}`)));
  return json({ id: summary.id, items });
};
var config = {
  path: "/api/history",
  method: ["GET", "POST", "DELETE"]
};
export {
  config,
  history_default as default
};
