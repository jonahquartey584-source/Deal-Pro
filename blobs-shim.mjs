// Stand-in for @netlify/blobs: keeps each store as plain files under ./local-data
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(process.env.DEALPRO_DATA || "local-data");
const enc = (k) => encodeURIComponent(k).replace(/\./g, "%2E");
export function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  const f = (k) => path.join(dir, enc(k));
  const readMeta = (k) => { try { return JSON.parse(fs.readFileSync(f(k) + ".meta", "utf8")); } catch { return {}; } };
  const raw = (k) => { try { return fs.readFileSync(f(k)); } catch { return null; } };
  const out = (buf, type) => buf == null ? null : type === "json" ? JSON.parse(buf.toString("utf8")) : type === "arrayBuffer" ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf.toString("utf8");
  const put = (k, v, o) => {
    fs.writeFileSync(f(k), typeof v === "string" || Buffer.isBuffer(v) ? v : v instanceof ArrayBuffer ? Buffer.from(v) : ArrayBuffer.isView(v) ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : String(v));
    fs.writeFileSync(f(k) + ".meta", JSON.stringify(o?.metadata || {}));
  };
  return {
    async get(k, o) { return out(raw(k), o?.type); },
    async getWithMetadata(k, o) { const b = raw(k); return b == null ? null : { data: out(b, o?.type), metadata: readMeta(k), etag: "local" }; },
    async getMetadata(k) { return raw(k) == null ? null : { metadata: readMeta(k), etag: "local" }; },
    async set(k, v, o) { put(k, v, o); return { modified: true }; },
    async setJSON(k, v, o) { put(k, JSON.stringify(v), o); return { modified: true }; },
    async delete(k) { for (const p of [f(k), f(k) + ".meta"]) try { fs.unlinkSync(p); } catch {} },
    async list(o) {
      const prefix = o?.prefix || "";
      const blobs = fs.readdirSync(dir).filter((n) => !n.endsWith(".meta")).map((n) => decodeURIComponent(n)).filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: "local" }));
      return { blobs, directories: [] };
    },
  };
}
export const getDeployStore = getStore;
