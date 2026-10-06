// Runs Deal Pro on your own computer: the same pages and the same /api functions as the live site,
// with no Netlify account, credits or Identity involved.
//
//   npm install
//   cp .env.example .env     (then put your OpenAI key in it)
//   npm run local            (opens http://localhost:8888)
//
// Netlify's pieces are swapped for local ones: Blobs becomes plain files in .local-data/, and
// Identity signs you in automatically as the local user (the admin by default). Everything else,
// including the AI searches and analyses, is the real code from netlify/functions.
import http from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const BUILD = path.join(ROOT, ".local-build");
const PORT = +process.env.PORT || 8888;

// .env: simple KEY=value lines; real environment variables win.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const base = process.env.OPENAI_BASE_URL;
if (base && !/(^|\.)openai\.com$/i.test(new URL(base).hostname)) delete process.env.OPENAI_BASE_URL; // never the Netlify gateway
const LOCAL_EMAIL = process.env.LOCAL_USER_EMAIL || "jonahquartey584@gmail.com";

// ---------- build: functions and the sign-in script, with Netlify's pieces swapped for local ones ----------
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
const alias = {
  "@netlify/blobs": path.join(ROOT, "local/shims/blobs.mjs"),
  "@netlify/identity": path.join(ROOT, "local/shims/identity.mjs"),
};
const fnFiles = readdirSync("netlify/functions").filter((f) => f.endsWith(".mts")).map((f) => path.join("netlify/functions", f));
await build({ entryPoints: fnFiles, outdir: path.join(BUILD, "functions"), bundle: true, platform: "node", format: "esm", outExtension: { ".js": ".mjs" },
  external: ["openai"], alias, logLevel: "error", banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
const browserAlias = { "@netlify/identity": path.join(ROOT, "local/shims/identity-browser.js") };
for (const name of ["auth", "admin"]) {
  await build({ entryPoints: [`src/${name}.js`], outfile: path.join(BUILD, "assets", `${name}.js`), bundle: true, format: "esm", minify: true, alias: browserAlias,
    banner: { js: `window.__DEALPRO_LOCAL_EMAIL=${JSON.stringify(LOCAL_EMAIL)};` }, logLevel: "error" });
}

// ---------- routes ----------
const routes = [];
for (const f of fnFiles) {
  const mod = await import(pathToFileURL(path.join(BUILD, "functions", path.basename(f).replace(/\.mts$/, ".mjs"))).href);
  const cfg = mod.config || {};
  if (!cfg.path || typeof mod.default !== "function") continue;
  routes.push({ path: cfg.path, methods: cfg.method ? [].concat(cfg.method) : null, background: !!cfg.background, handler: mod.default, name: path.basename(f) });
}

const cookiesOf = (req) => {
  const jar = new Map();
  for (const part of String(req.headers.cookie || "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1)); }
  return { get: (n) => jar.get(n), getAll: () => [...jar].map(([name, value]) => ({ name, value })), set() {}, delete() {} };
};

async function callFunction(route, req, res, url) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(url, { method: req.method, headers: req.headers, ...(["GET", "HEAD"].includes(req.method) || !body.length ? {} : { body }) });
  const context = { cookies: cookiesOf(req), ip: req.socket.remoteAddress, geo: {}, site: { id: "local", name: "deal-pro-local", url: url.origin }, account: { id: "local" }, requestId: crypto.randomUUID(), deploy: { id: "local" }, params: {}, waitUntil() {}, json: (d, i) => Response.json(d, i) };
  if (route.background) {
    // Background functions answer straight away and carry on running.
    Promise.resolve(route.handler(request, context)).catch((e) => console.error(`[${route.name}]`, e));
    res.writeHead(202); res.end(); return;
  }
  let response;
  try { response = await route.handler(request, context); } catch (e) { console.error(`[${route.name}]`, e); response = Response.json({ error: "Server error" }, { status: 500 }); }
  if (!(response instanceof Response)) response = new Response(null, { status: 204 });
  const headers = {};
  for (const [k, v] of response.headers) if (k !== "set-cookie") headers[k] = v;
  const setCookie = response.headers.getSetCookie?.() || [];
  // Secure cookies don't work on plain http for every browser; drop the flag locally.
  if (setCookie.length) headers["set-cookie"] = setCookie.map((c) => c.replace(/;\s*Secure/i, ""));
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

// ---------- static files (same private paths as netlify.toml) ----------
const PRIVATE = /^\/(netlify|src|docs|scripts|node_modules|local|\.git|\.local-data|\.local-build|\.netlify)(\/|$)|^\/(package\.json|package-lock\.json|netlify\.toml|README\.md|\.env(\..*)?|\.gitignore)$/;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".json": "application/json", ".txt": "text/plain", ".xml": "application/xml", ".woff2": "font/woff2" };

async function serveStatic(req, res, pathname) {
  if (PRIVATE.test(pathname)) { res.writeHead(404); res.end("Not found"); return; }
  let file = pathname.startsWith("/assets/auth.js") || pathname.startsWith("/assets/admin.js") ? path.join(BUILD, pathname) : path.join(ROOT, pathname);
  if (!path.resolve(file).startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
  const size = statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range) { // video seeking
    const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], size - 1) : size - 1;
    const data = (await readFile(file)).subarray(start, end + 1);
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": data.length }); res.end(data); return;
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  res.end(await readFile(file));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost:" + PORT}`);
  try {
    const route = routes.find((r) => r.path === url.pathname && (!r.methods || r.methods.includes(req.method)));
    if (route) return await callFunction(route, req, res, url);
    if (url.pathname.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"Not found"}'); return; }
    await serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end("Server error"); }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\nDeal Pro is running locally at http://localhost:${PORT}`);
  console.log(`Signed in as ${LOCAL_EMAIL} (data is kept in .local-data/)`);
  if (!process.env.OPENAI_API_KEY) console.log("\n! OPENAI_API_KEY is not set. Add it to a .env file or the AI features will say they are unavailable.");
});
