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

// netlify/functions/evidence.mts
var MAX_BYTES = 4 * 1024 * 1024;
var MAX_FILES = 500;
var TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "message/rfc822": "eml",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};
var BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([t, e]) => [e, t]));
BY_EXT.jpeg = "image/jpeg";
var store = () => getStore({ name: "deal-evidence", consistency: "strong" });
var json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
var validId = (id) => !!id && /^[0-9a-f-]{36}$/.test(id);
var evidence_default = async (request, _context) => {
  const user = await getUser();
  if (!user) return json({ error: "Please sign in to manage evidence." }, 401);
  const prefix = `${user.id}/`;
  const id = new URL(request.url).searchParams.get("id");
  if (request.method === "GET") {
    if (!validId(id)) return json({ error: "Unknown file." }, 404);
    const file2 = await store().getWithMetadata(prefix + id, { type: "arrayBuffer" });
    if (!file2) return json({ error: "This file no longer exists." }, 404);
    const meta = file2.metadata;
    const type2 = meta.type && TYPES[meta.type] ? meta.type : "application/octet-stream";
    const inline = type2.startsWith("image/") || type2 === "application/pdf";
    const name2 = String(meta.name || "evidence").replace(/[^\w .()-]/g, "_");
    return new Response(file2.data, {
      headers: {
        "Content-Type": type2,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name2}"; filename*=UTF-8''${encodeURIComponent(String(meta.name || "evidence"))}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...type2 === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'" }
      }
    });
  }
  if (request.method === "DELETE") {
    if (!validId(id)) return json({ error: "Unknown file." }, 404);
    await store().delete(prefix + id);
    return json({ ok: true });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return json({ error: "Choose a file to upload." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Files must be under 4 MB. Compress the file or split it, then try again." }, 413);
  if (!file.size) return json({ error: "That file is empty." }, 400);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = TYPES[file.type] ? file.type : BY_EXT[ext];
  if (!type) return json({ error: "Upload a photo, PDF, Word or Excel document, email (.eml), or text or CSV file." }, 415);
  const { blobs } = await store().list({ prefix });
  if (blobs.length >= MAX_FILES) return json({ error: `You've reached the limit of ${MAX_FILES} evidence files. Remove some you no longer need.` }, 409);
  const fileId = crypto.randomUUID();
  const name = file.name.slice(0, 150) || `evidence.${TYPES[type]}`;
  const at = (/* @__PURE__ */ new Date()).toISOString();
  await store().set(prefix + fileId, await file.arrayBuffer(), { metadata: { name, type, size: file.size, at } });
  return json({ id: fileId, name, type, size: file.size, at }, 201);
};
var config = { path: "/api/evidence", method: ["GET", "POST", "DELETE"] };
export {
  config,
  evidence_default as default
};
