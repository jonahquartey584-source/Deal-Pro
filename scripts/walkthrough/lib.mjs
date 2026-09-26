// Shared recorder for the site walkthrough videos: serves the site locally,
// drives it in a headless browser with demo sign-in and API responses, and
// captures it frame by frame on a virtual clock while an on-screen cursor
// clicks, types and scrolls. Each video script supplies its own demo data and
// timeline, then calls finish() to encode the frames with its narration.
//
//   npm i -g playwright geist && pip3 install imageio-ffmpeg
//
// PREVIEW=1 writes one frame a second to .tutorial-build/frames and skips the video.
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const OUT = path.join(ROOT, "assets");
const WORK = path.join(ROOT, ".tutorial-build");
const FRAMES = path.join(WORK, "frames");
const FPS = +process.env.FPS || 30;
const PREVIEW = +process.env.PREVIEW || 0;
export const W = 1280, H = 720;
const SCALE = 1.5; // rendered at 1920x1080

function resolveModule(name) {
  try { return require.resolve(name); } catch {}
  const global = execFileSync("npm", ["root", "-g"]).toString().trim();
  return require.resolve(path.join(global, name));
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); } catch {}
  return "ffmpeg";
}
const FFMPEG = ffmpegPath();

export function audioSeconds(audio) {
  const probe = (() => { try { execFileSync(FFMPEG, ["-i", audio], { stdio: "pipe" }); return ""; } catch (e) { return String(e.stderr); } })();
  const m = probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Could not read the narration at ${audio}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

export const LISTINGS = JSON.parse((await readFile(path.join(ROOT, "index.html"), "utf8")).match(/const LISTINGS=(\[[\s\S]*?\n\]);/)[1]);

// Stand-in for assets/auth.js. Signed out, the sign-in form signs straight in.
const authStub = (signedIn) => `
const $ = (s) => document.querySelector(s);
const signIn = () => {
  $("#authGate").hidden = true;
  document.body.classList.remove("signed-out");
  $(".ws-name").textContent = "Alex Morgan";
  $("#accountEmail").textContent = "alex@example.com";
  document.body.dataset.userId = "demo";
  document.body.dataset.userEmail = "alex@example.com";
  window.dispatchEvent(new Event("dealpro:signed-in"));
};
document.body.classList.remove("auth-pending");
document.body.classList.add("simple-mode");
${signedIn ? "signIn();" : `document.body.classList.add("signed-out");
$("#authOauth").hidden = false;
$("#homeSignIn").addEventListener("click", () => { $("#authGate").hidden = false; });
$("#authForm").addEventListener("submit", (e) => { e.preventDefault(); signIn(); });`}`;

// The cursor drawn over the page, with a small "AI" tag and a ring on each click.
const CURSOR = `
addEventListener("DOMContentLoaded", () => {
  const c = document.createElement("div");
  c.id = "demoCursor";
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 2.5v18.2l4.6-4.4 3 6.9 3.3-1.4-3-6.8h6.4z" fill="#fff" stroke="#0B0B0C" stroke-width="1.6" stroke-linejoin="round"/></svg><span>AI</span><i></i>';
  const s = document.createElement("style");
  s.textContent = "#demoCursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;view-transition-name:demo-cursor;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}" +
    "#demoCursor svg{display:block;transform-origin:4px 3px;transition:transform .12s}#demoCursor.down svg{transform:scale(.86)}" +
    "#demoCursor span{position:absolute;left:21px;top:19px;font:600 10px/1 Geist,system-ui,sans-serif;letter-spacing:.04em;color:#fff;background:#E0142B;border-radius:5px;padding:3px 5px}" +
    "#demoCursor i{position:absolute;left:-14px;top:-15px;width:36px;height:36px;border-radius:50%;border:2px solid #E0142B;opacity:0;transform:scale(.3)}" +
    "#demoCursor.ring i{animation:demoRing .5s ease-out}@keyframes demoRing{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.4)}}" +
    "::-webkit-scrollbar{display:none}";
  document.head.append(s);
  document.body.append(c);
  window.__cursor = (x, y) => { c.style.transform = "translate(" + x + "px," + y + "px)"; };
  window.__cursor(${W + 40}, ${H * 0.7});
});`;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".mp4": "video/mp4", ".woff2": "font/woff2" };

/**
 * Opens the site and returns the director helpers. Options:
 *   state     dealpro:state saved in the browser before the page loads
 *   signedIn  start signed in (default: signed out, sign in via the form)
 *   api(url, method, body)  returns the JSON for an /api request
 */
export async function start({ state, signedIn = false, api }) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const BASE = `http://127.0.0.1:${server.address().port}`;

  const playwright = await import(resolveModule("playwright"));
  const { chromium } = playwright.default ?? playwright;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, reducedMotion: "no-preference" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.warn("page error:", e.message));

  // Geist comes from Google Fonts on the live site; serve it from the geist npm package instead.
  let geistDir = null;
  try { geistDir = path.join(path.dirname(resolveModule("geist/package.json")), "dist", "fonts"); } catch {}
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    if (!geistDir) return route.abort();
    return route.fulfill({ contentType: "text/css", body:
      `@font-face{font-family:Geist;font-weight:100 900;src:url(${BASE}/__geist/geist-sans/Geist-Variable.woff2) format("woff2")}` +
      `@font-face{font-family:"Geist Mono";font-weight:100 900;src:url(${BASE}/__geist/geist-mono/GeistMono-Variable.woff2) format("woff2")}` });
  });
  await page.route("**/__geist/**", async (route) => {
    const rel = new URL(route.request().url()).pathname.replace("/__geist/", "");
    route.fulfill({ contentType: "font/woff2", body: await readFile(path.join(geistDir, rel)) });
  });
  await page.route("**/assets/auth.js", (route) => route.fulfill({ contentType: "text/javascript", body: authStub(signedIn) }));
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    let body = null;
    try { body = req.postDataJSON(); } catch {}
    const [status, data] = await api(new URL(req.url()), req.method(), body);
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.addInitScript(`try{localStorage.setItem("dealpro:state",${JSON.stringify(JSON.stringify(state))});localStorage.setItem("dealpro:ai-level","quick");sessionStorage.clear()}catch(e){}`);
  await page.addInitScript(CURSOR);
  await page.clock.install({ time: new Date("2026-09-26T10:00:00") });
  await page.goto(BASE + "/");
  await page.evaluate(() => document.fonts.ready);

  /* ---------- director: every helper advances virtual time frame by frame ---------- */
  await rm(WORK, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });
  const DT = 1 / FPS;
  let t = 0, frame = 0, cx = W + 40, cy = H * 0.7;

  async function shoot() {
    await page.clock.runFor(Math.round(DT * 1000));
    t += DT;
    if (PREVIEW && frame % Math.round(FPS / PREVIEW)) { frame++; return; }
    await page.screenshot({ path: path.join(FRAMES, `${String(frame).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    frame++;
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  async function until(time) { while (t < time - 1e-6) await shoot(); }
  async function center(sel) {
    let b = null;
    // A view cross-fade hides the real page for a moment; wait it out (real time, no frames).
    for (let i = 0; i < 40 && !b; i++) {
      b = await page.locator(sel).first().boundingBox();
      if (!b) await page.waitForTimeout(50);
    }
    if (!b) { await page.screenshot({ path: path.join(WORK, "debug.png") }); throw new Error(`Not on screen: ${sel} (page: ${await page.evaluate(() => document.documentElement.dataset.page)})`); }
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  // Glide the cursor to a selector (or {x, y}) over `dur` seconds on a gentle arc.
  async function move(target, dur = 0.8, dx = 0, dy = 0) {
    const p = typeof target === "string" ? await center(target) : target;
    const x0 = cx, y0 = cy, x1 = p.x + dx, y1 = p.y + dy, n = Math.max(1, Math.round(dur * FPS));
    const bend = Math.min(60, Math.hypot(x1 - x0, y1 - y0) * 0.12);
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n), arc = Math.sin(Math.PI * k) * bend;
      cx = x0 + (x1 - x0) * k; cy = y0 + (y1 - y0) * k - arc;
      await page.evaluate(([x, y]) => window.__cursor(x, y), [cx, cy]);
      await page.mouse.move(cx, cy);
      await shoot();
    }
  }
  // real=false shows the click without sending it (a real click on a <select> opens a native menu).
  async function click(real = true) {
    await page.evaluate(() => { const c = document.getElementById("demoCursor"); c.classList.remove("ring"); void c.offsetWidth; c.classList.add("down", "ring"); });
    await shoot(); await shoot();
    if (real) { await page.mouse.down(); await page.mouse.up(); }
    await page.evaluate(() => document.getElementById("demoCursor").classList.remove("down"));
    await shoot();
  }
  async function moveClick(target, dur, dx, dy) { await move(target, dur, dx, dy); await click(); }
  async function type(text, dur) {
    const per = Math.max(1, Math.ceil(text.length / Math.max(1, Math.round(dur * FPS))));
    for (let i = 0; i < text.length; i += per) { await page.keyboard.type(text.slice(i, i + per)); await shoot(); }
  }
  // Smoothly scroll the window so `sel` sits `offset` px from the top (or to a y value).
  async function scroll(target, dur = 0.9, offset = 90) {
    const from = await page.evaluate(() => scrollY);
    const to = typeof target === "number" ? target : await page.evaluate(([s, o]) => Math.max(0, document.querySelector(s).getBoundingClientRect().top + scrollY - o), [target, offset]);
    const n = Math.max(1, Math.round(dur * FPS));
    for (let i = 1; i <= n; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), from + (to - from) * ease(i / n));
      await shoot();
    }
  }

  // Encodes the frames with the narration into assets/<video>, and a poster frame into assets/<poster>.
  async function finish({ audio, video, poster, posterAt }) {
    await browser.close();
    server.close();
    if (PREVIEW) { console.log(`Preview frames in ${FRAMES}`); return; }
    const posterFrame = path.join(FRAMES, `${String(Math.round(posterAt * FPS)).padStart(5, "0")}.jpg`);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", posterFrame, "-vf", `scale=${W}:${H}:flags=lanczos`, path.join(OUT, poster)]);
    execFileSync(FFMPEG, [
      "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FRAMES, "%05d.jpg"), "-i", audio,
      "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", path.join(OUT, video),
    ], { stdio: "inherit" });
    console.log(path.join(OUT, video));
  }

  return { page, until, move, click, moveClick, type, scroll, shoot, finish, now: () => t };
}

// A new empty deal on a Premium account, so every power level is available.
export function premiumState(deal = {}) {
  return {
    plan: "Pro",
    deal: {
      id: "d100", name: "New deal", area: "", strat: "R2SA", london: false, status: "Checking",
      units: [{ label: "Unit 1", rent: 0, dep: 0, rate: 0 }], a: { fee: 15, clean: 45, stay: 3, other: 150 },
      dd: ["terms", "consent", "ninety", "licence", "tax", "location", "safety", "rates"].map((k) => ({ k, s: "none", n: "" })), ai: false,
      pack: { biz: "", redress: "", fee: "", nda: true, final: false },
      send: { co: "", email: "", addr: "", ll: "", role: "Owner / landlord", phone: "", lemail: "", use: "Serviced accommodation", docs: "Advert, photos, landlord emails" },
      ...deal,
    },
    saved: [],
  };
}
