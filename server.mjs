// Deal Pro, running on your own computer. Same pages and same code as the live site.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(here);

// ---- settings from .env (never shared, never uploaded) ----
if (fs.existsSync(".env")) for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const PORT = Number(process.env.PORT) || 8888;
if (!process.env.OPENAI_API_KEY) console.log("\n  NOTE: no OPENAI_API_KEY in the .env file yet, so searches and analysis will not work.\n  Open the file called .env, paste your key after the = sign, save, and start again.\n");

// ---- load the functions ----
const routes = [];
for (const file of fs.readdirSync("functions").filter((f) => f.endsWith(".mjs"))) {
  const mod = await import(pathToFileURL(path.resolve("functions", file)).href);
  const c = mod.config || {};
  if (!c.path) continue;
  routes.push({ path: c.path, methods: [].concat(c.method || ["GET", "POST", "PUT", "PATCH", "DELETE"]), bg: !!c.background, handler: mod.default });
}
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain" };
const cookieJar = { get: () => undefined, set() {}, delete() {} };

// ---- accounts (online mode): set ADMIN_PASSWORD to turn on sign-in for clients ----
const ADMIN_EMAIL = "jonahquartey584@gmail.com";
const MULTI = !!process.env.ADMIN_PASSWORD;
const { AsyncLocalStorage } = await import("node:async_hooks");
const crypto = await import("node:crypto");
const als = (globalThis.__dpUser = new AsyncLocalStorage());
const dataDir = path.resolve(process.env.DEALPRO_DATA || "local-data"); fs.mkdirSync(dataDir, { recursive: true });
const { getStore } = await import(pathToFileURL(path.resolve("blobs-shim.mjs")).href);
const users = () => getStore({ name: "deal-users" });
let SECRET = process.env.SESSION_SECRET || "";
if (!SECRET) { const f = path.join(dataDir, ".session-secret"); try { SECRET = fs.readFileSync(f, "utf8"); } catch { SECRET = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(f, SECRET); } }
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
const emailKey = (e) => "email/" + crypto.createHash("sha256").update(e).digest("hex");
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, admin: u.email === ADMIN_EMAIL });
async function saveUser(email, name, password, id = crypto.randomUUID()) {
  const salt = crypto.randomBytes(16).toString("hex");
  const u = { id, email, name: name || "", salt, hash: hashPw(password, salt) };
  await users().setJSON(emailKey(email), u); await users().setJSON("id/" + id, { email }); return u;
}
if (MULTI) {
  const existing = await users().get(emailKey(ADMIN_EMAIL), { type: "json" });
  if (!existing) await saveUser(ADMIN_EMAIL, "Jonah", process.env.ADMIN_PASSWORD);
  else if (existing.hash !== hashPw(process.env.ADMIN_PASSWORD, existing.salt)) await saveUser(ADMIN_EMAIL, existing.name, process.env.ADMIN_PASSWORD, existing.id);
}
const cookieOf = (req, n) => String(req.headers.cookie || "").split(/;\s*/).map((c) => c.split("=")).find(([k]) => k === n)?.[1];
async function sessionUser(req) {
  if (!MULTI) return { id: "local-admin", email: ADMIN_EMAIL, name: "Jonah" };
  const c = cookieOf(req, "dp_session"); if (!c) return null;
  const [id, exp, sig] = c.split(".");
  if (!id || Date.now() > Number(exp) || sig !== sign(id + "." + exp)) return null;
  const idx = await users().get("id/" + id, { type: "json" }); if (!idx) return null;
  const u = await users().get(emailKey(idx.email), { type: "json" });
  return u ? publicUser(u) : null;
}
const setSession = (req, res, id) => {
  const exp = Date.now() + 90 * 864e5;
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `dp_session=${id}.${exp}.${sign(id + "." + exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 86400}${secure}`);
};
const tries = new Map();
const tooMany = (ip) => { const now = Date.now(); const a = (tries.get(ip) || []).filter((t) => now - t < 15 * 60e3); a.push(now); tries.set(ip, a); return a.length > 20; };
const sendJson = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
async function authApi(req, res, url) {
  const act = url.pathname.slice("/api/auth/".length);
  if (act === "me") return sendJson(res, 200, { user: await sessionUser(req) });
  if (act === "logout") { res.setHeader("Set-Cookie", "dp_session=; Path=/; Max-Age=0"); return sendJson(res, 200, { ok: true }); }
  if (req.method !== "POST" || !["login", "signup"].includes(act)) return sendJson(res, 404, { error: "Not found." });
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim();
  if (tooMany(ip)) return sendJson(res, 429, { error: "Too many attempts. Please wait a few minutes." });
  const chunks = []; for await (const c of req) chunks.push(c);
  let b = {}; try { b = JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch {}
  const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email address." });
  if (act === "signup") {
    if (password.length < 8) return sendJson(res, 400, { error: "Use a password of at least 8 characters." });
    if (email === ADMIN_EMAIL || await users().get(emailKey(email), { type: "json" })) return sendJson(res, 409, { error: "An account with that email already exists. Sign in instead." });
    const u = await saveUser(email, String(b.name || "").slice(0, 80), password);
    setSession(req, res, u.id); return sendJson(res, 200, { user: publicUser(u) });
  }
  const u = await users().get(emailKey(email), { type: "json" });
  if (!u || hashPw(password, u.salt) !== u.hash) return sendJson(res, 401, { error: "Email or password is not right." });
  setSession(req, res, u.id); return sendJson(res, 200, { user: publicUser(u) });
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/auth/")) return await authApi(req, res, url);
    const route = routes.find((r) => r.path === url.pathname && r.methods.includes(req.method));
    if (route) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const who = await sessionUser(req);
      const run = () => als.run(who, () => route.handler(request, { cookies: cookieJar, ip: "127.0.0.1", geo: {}, params: {}, next() {} }));
      if (route.bg) { run().catch((e) => console.error("background job error:", e)); res.writeHead(202); return res.end(); }
      const r = await run();
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"error":"Not available in the local copy."}'); }
    let p = decodeURIComponent(url.pathname);
    if (p === "/assets/auth.js" && MULTI) p = "/assets/auth-multi.js";
    if (p.startsWith("/pack/")) p = "/pack.html";
    if (p === "/") p = "/index.html";
    const file = path.join(here, "site", path.normalize(p).replace(/^(\.\.[\/\\])+/, ""));
    if (!file.startsWith(path.join(here, "site")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); res.writeHead(500); res.end("Local server error"); }
}).listen(PORT, MULTI ? "0.0.0.0" : "127.0.0.1", () => console.log(`\n  Deal Pro is running.\n  Open this in your browser:  http://localhost:${PORT}\n  Leave this window open while you use it. Press Ctrl+C to stop.\n`));
