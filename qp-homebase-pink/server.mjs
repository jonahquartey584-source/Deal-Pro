// Qp Homebase "Ruby Edition": a private personal app that runs on
// your own computer. Start with `node server.mjs`, then open
// http://localhost:4400 (or the Tailscale address from scripts/phone.sh on a phone).
// No npm packages needed. Everything is saved in data/homebase.json.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { runAssistant } from "./lib/assistant.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "public");
export const DATA_DIR = process.env.DATA_DIR || path.join(here, "data");
const DATA_FILE = path.join(DATA_DIR, "homebase.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const PORT = Number(process.env.PORT || 4400);
const HOST = process.env.HOST || "127.0.0.1";
const VERSION = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8")).version;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png",
  ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".webp": "image/webp",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
};

// ---------- storage ----------
fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1));
  fs.renameSync(tmp, file);
}

let doc = readJson(DATA_FILE, { rev: 0, data: null, savedAt: null });
let settings = readJson(SETTINGS_FILE, { apiKey: "", model: "claude-opus-5-5" });

// Keep a daily backup of the data file (last 14 days).
function dailyBackup() {
  if (!doc.data) return;
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const name = `homebase-${new Date().toISOString().slice(0, 10)}.json`;
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) writeJson(file, doc);
  const old = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().slice(0, -14);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
}

export function saveData(data, baseRev) {
  if (typeof baseRev === "number" && baseRev !== doc.rev) {
    const err = new Error("Changed on another device"); err.status = 409; err.current = doc; throw err;
  }
  doc = { rev: doc.rev + 1, data, savedAt: new Date().toISOString() };
  writeJson(DATA_FILE, doc);
  dailyBackup();
  return doc;
}

// ---------- http ----------
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function send(res, status, body) {
  const json = Buffer.from(JSON.stringify(body));
  const gz = json.length > 1024 && /\bgzip\b/.test(res.req?.headers["accept-encoding"] || "");
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(gz && { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }) });
  res.end(gz ? zlib.gzipSync(json, { level: 6 }) : json);
}

async function readBody(req, limit = 20 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, "Too big"); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Invalid JSON"); }
}

// Fast static files: ETags (so the phone can reuse what it has), gzip/brotli
// for text, long caching for fonts/images/videos, and Range support (Safari on
// iPhone only plays video when the server answers Range requests with 206).
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg"]);
const zipCache = new Map(); // file -> { key, br, gz }
function compressed(file, stat) {
  const key = `${stat.size}-${stat.mtimeMs}`;
  let c = zipCache.get(file);
  if (!c || c.key !== key) {
    const raw = fs.readFileSync(file);
    c = { key, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }), gz: zlib.gzipSync(raw, { level: 9 }) };
    zipCache.set(file, c);
  }
  return c;
}
function cachePolicy(rel) {
  if (/^(media|fonts)\//.test(rel)) return "public, max-age=2592000, immutable"; // requested with ?v=version
  if (/^brand\/|\.png$|\.jpg$/.test(rel)) return "public, max-age=86400";
  return "no-cache"; // html, js, css, sw: revalidate (cheap 304s); the service worker serves them instantly
}
function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found");
  }
  const stat = fs.statSync(file), ext = path.extname(file), size = stat.size;
  const etag = `"${size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": cachePolicy(rel), ETag: etag, Vary: "Accept-Encoding" };
  if (rel === "sw.js") headers["Service-Worker-Allowed"] = "/";
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? +range[1] : Math.max(0, size - +range[2]);
    let end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  const ae = req.headers["accept-encoding"] || "";
  if (COMPRESSIBLE.has(ext) && /\b(br|gzip)\b/.test(ae)) {
    const c = compressed(file, stat), useBr = /\bbr\b/.test(ae), body = useBr ? c.br : c.gz;
    res.writeHead(200, { ...headers, "Content-Encoding": useBr ? "br" : "gzip", "Content-Length": body.length });
    return res.end(req.method === "HEAD" ? undefined : body);
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

const settingsView = () => ({
  model: settings.model || "claude-opus-5-5",
  hasApiKey: Boolean(settings.apiKey || process.env.ANTHROPIC_API_KEY),
  keyHint: settings.apiKey ? `${settings.apiKey.slice(0, 7)}…${settings.apiKey.slice(-4)}` : "",
});

// Only answer to this computer and to Tailscale addresses (*.ts.net), so other
// web pages can't reach the app through DNS tricks.
function hostAllowed(hostHeader = "") {
  const host = hostHeader.replace(/:\d+$/, "").toLowerCase();
  const extra = (process.env.ALLOWED_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return ["localhost", "127.0.0.1", "[::1]", ...extra].includes(host) || host.endsWith(".ts.net");
}

export const server = http.createServer(async (req, res) => {
  try {
    if (!hostAllowed(req.headers.host)) throw new HttpError(403, "Host not allowed");
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (!p.startsWith("/api/")) return serveStatic(req, res, p);
    if (req.method !== "GET" && req.headers["x-homebase"] !== "1") throw new HttpError(403, "Missing header");

    if (req.method === "GET" && p === "/api/health") return send(res, 200, { ok: true, version: VERSION });
    if (req.method === "GET" && p === "/api/state") return send(res, 200, doc);
    if (req.method === "PUT" && p === "/api/state") {
      const body = await readBody(req);
      if (!body.data || typeof body.data !== "object") throw new HttpError(400, "data missing");
      try { return send(res, 200, { rev: saveData(body.data, body.force ? undefined : body.rev).rev }); }
      catch (e) { if (e.status === 409) return send(res, 409, { error: e.message, current: e.current }); throw e; }
    }
    if (req.method === "GET" && p === "/api/settings") return send(res, 200, settingsView());
    if (req.method === "PUT" && p === "/api/settings") {
      const body = await readBody(req);
      if (typeof body.apiKey === "string") settings.apiKey = body.apiKey.trim();
      if (typeof body.model === "string" && body.model.trim()) settings.model = body.model.trim();
      writeJson(SETTINGS_FILE, settings);
      return send(res, 200, settingsView());
    }
    if (req.method === "POST" && p === "/api/assistant") {
      const body = await readBody(req);
      const apiKey = settings.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new HttpError(401, "Add your Anthropic API key in Settings to use the assistant.");
      const out = await runAssistant({
        apiKey, model: settings.model || "claude-opus-5-5",
        messages: body.messages || [], data: doc.data || {}, today: body.today, now: body.now,
      });
      let rev = doc.rev;
      if (out.changed) rev = saveData(out.data).rev;
      return send(res, 200, { reply: out.reply, changed: out.changed, rev, data: out.changed ? out.data : undefined });
    }
    throw new HttpError(404, "Not found");
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    send(res, status, { error: err.message || String(err) });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => console.log(`Qp Homebase Ruby Edition ${VERSION} running at http://localhost:${PORT}`));
}
