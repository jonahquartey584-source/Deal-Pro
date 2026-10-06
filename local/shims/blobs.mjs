// Stand-in for @netlify/blobs: the same store API, kept in plain files under .local-data/.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env.DEALPRO_DATA_DIR || ".local-data");
const enc = (s) => encodeURIComponent(s).replace(/%2F/g, "__SL__");
const dec = (s) => decodeURIComponent(s.replace(/__SL__/g, "%2F"));

export function getStore(opts) {
  const name = typeof opts === "string" ? opts : opts.name;
  const dir = path.join(ROOT, enc(name));
  mkdirSync(dir, { recursive: true });
  const file = (key) => path.join(dir, enc(key));
  const meta = (key) => file(key) + ".meta.json";
  const write = (key, data, o = {}) => {
    writeFileSync(file(key), data);
    writeFileSync(meta(key), JSON.stringify(o.metadata ?? {}));
  };
  return {
    async get(key, o = {}) {
      if (!existsSync(file(key))) return null;
      const buf = readFileSync(file(key));
      if (o.type === "json") return JSON.parse(buf.toString("utf8"));
      if (o.type === "arrayBuffer") return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return buf.toString("utf8");
    },
    async getMetadata(key) {
      if (!existsSync(file(key))) return null;
      let metadata = {};
      try { metadata = JSON.parse(readFileSync(meta(key), "utf8")); } catch {}
      return { etag: String(statSync(file(key)).mtimeMs), metadata };
    },
    async set(key, data, o) {
      write(key, typeof data === "string" || data instanceof Uint8Array ? data : Buffer.from(data), o);
    },
    async setJSON(key, data, o) { write(key, JSON.stringify(data), o); },
    async delete(key) { rmSync(file(key), { force: true }); rmSync(meta(key), { force: true }); },
    async list(o = {}) {
      const prefix = o.prefix || "";
      const blobs = readdirSync(dir).filter((f) => !f.endsWith(".meta.json")).map(dec).filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key, etag: "" }));
      return { blobs, directories: [] };
    },
  };
}
