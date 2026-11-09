// Day Planner: a local web app for your daily tasks. Run `node server.mjs` and
// open http://localhost:4321 (only reachable from this computer).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./lib/store.mjs";
import { parseSchedule } from "./lib/importers.mjs";
import * as ai from "./lib/ai.mjs";
import { isDateStr, today } from "./lib/dates.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "public");
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || "127.0.0.1";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", ...(process.env.ALLOWED_HOSTS || "").split(",").filter(Boolean)]);

store.load();

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 8 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "That file is too big (8 MB max).");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}

function settingsView() {
  const s = store.getState().settings;
  const key = s.apiKey;
  return {
    model: s.model,
    name: s.name,
    hasApiKey: Boolean(ai.keySource()),
    keySource: ai.keySource(),
    keyHint: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : "",
    dataDir: store.DATA_DIR,
  };
}

const routes = [
  ["GET", /^\/api\/health$/, () => ({ ok: true, today: today() })],

  ["GET", /^\/api\/day$/, (req, url) => {
    const date = url.searchParams.get("date") || today();
    if (!isDateStr(date)) throw new HttpError(400, "date must be YYYY-MM-DD");
    return { date, tasks: store.tasksForDate(date) };
  }],

  // Tasks for a range of days (for the week strip): counts only.
  ["GET", /^\/api\/summary$/, (req, url) => {
    const from = url.searchParams.get("from");
    const days = Math.min(Number(url.searchParams.get("days") || 7), 42);
    if (!isDateStr(from)) throw new HttpError(400, "from must be YYYY-MM-DD");
    const out = {};
    const d = new Date(from + "T00:00");
    for (let i = 0; i < days; i++) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const tasks = store.tasksForDate(ds);
      out[ds] = { total: tasks.length, done: tasks.filter((t) => t.done).length };
      d.setDate(d.getDate() + 1);
    }
    return out;
  }],

  ["POST", /^\/api\/tasks$/, async (req) => {
    const body = await readBody(req);
    if (!body.title?.trim()) throw new HttpError(400, "A task needs a title");
    return store.addTask(body);
  }],
  ["PATCH", /^\/api\/tasks\/([\w-]+)$/, async (req, url, [id]) => {
    const task = store.updateTask(id, await readBody(req));
    if (!task) throw new HttpError(404, "Task not found");
    return task;
  }],
  ["DELETE", /^\/api\/tasks\/([\w-]+)$/, (req, url, [id]) => {
    if (!store.deleteTask(id)) throw new HttpError(404, "Task not found");
    return { ok: true };
  }],
  ["POST", /^\/api\/carry-over$/, async (req) => {
    const { from, to } = await readBody(req);
    if (!isDateStr(from) || !isDateStr(to)) throw new HttpError(400, "from and to must be YYYY-MM-DD");
    return { moved: store.carryOver(from, to).length };
  }],

  ["GET", /^\/api\/schedule$/, () => ({ items: store.getState().schedule })],
  ["POST", /^\/api\/schedule$/, async (req) => {
    const body = await readBody(req);
    if (!body.title?.trim()) throw new HttpError(400, "A schedule item needs a title");
    return store.addScheduleItems([body])[0];
  }],
  ["PATCH", /^\/api\/schedule\/([\w-]+)$/, async (req, url, [id]) => {
    const item = store.updateScheduleItem(id, await readBody(req));
    if (!item) throw new HttpError(404, "Schedule item not found");
    return item;
  }],
  ["DELETE", /^\/api\/schedule\/([\w-]+)$/, (req, url, [id]) => {
    if (!store.deleteScheduleItem(id)) throw new HttpError(404, "Schedule item not found");
    return { ok: true };
  }],
  ["DELETE", /^\/api\/schedule$/, () => { store.clearSchedule(); return { ok: true }; }],

  // Parses a schedule. With `commit: true` it saves the items, otherwise it
  // returns a preview. `useAi: true` reads it with Claude.
  ["POST", /^\/api\/import$/, async (req) => {
    const { filename = "", content = "", items: confirmed, commit, replace, useAi } = await readBody(req);
    if (commit && Array.isArray(confirmed)) {
      const added = store.addScheduleItems(confirmed, { replace: Boolean(replace), source: filename || "import" });
      return { added: added.length };
    }
    if (!content.trim()) throw new HttpError(400, "The schedule is empty.");
    let result;
    if (useAi) {
      result = await ai.extractSchedule(content);
    } else {
      try {
        result = parseSchedule(filename, content);
      } catch (e) {
        throw new HttpError(400, `Couldn't read that file: ${e.message}`);
      }
    }
    return result;
  }],

  ["GET", /^\/api\/settings$/, () => settingsView()],
  ["POST", /^\/api\/settings$/, async (req) => {
    store.updateSettings(await readBody(req));
    return settingsView();
  }],

  ["POST", /^\/api\/chat$/, async (req) => {
    const { messages, date } = await readBody(req);
    return ai.chat(messages, date);
  }],

  ["GET", /^\/api\/export$/, () => {
    const { settings, ...rest } = store.getState();
    return { exportedAt: new Date().toISOString(), ...rest };
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    // Only answer to localhost names, so other websites can't reach the app
    // through DNS tricks.
    const hostname = (req.headers.host || "").replace(/:\d+$/, "");
    if (!ALLOWED_HOSTS.has(hostname)) throw new HttpError(403, "Forbidden host");
    if (url.pathname.startsWith("/api/")) {
      // Only accept API calls from this app's own pages.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, "Cross-origin requests are not allowed");
      for (const [method, re, handler] of routes) {
        const m = url.pathname.match(re);
        if (m && req.method === method) return send(res, 200, await handler(req, url, m.slice(1)));
      }
      throw new HttpError(404, "Not found");
    }
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Method not allowed");
    serveStatic(req, res, url.pathname);
  } catch (err) {
    const { status, message } = err instanceof HttpError ? err : ai.friendlyError(err);
    if (status >= 500) console.error(err);
    send(res, status, { error: message });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Is the planner already running? Open http://localhost:${PORT}`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Day Planner running at http://localhost:${PORT}  (data: ${store.DATA_DIR})`);
});
