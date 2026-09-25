// Records the homepage tutorial as a real walkthrough of the site: a headless
// browser plays through each feature while an on-screen cursor clicks, types
// and scrolls in time with the narration.
//
//   npm i --no-save playwright geist imageio-ffmpeg   (or have them installed globally)
//   node scripts/record_walkthrough.mjs [narration.mp3]
//
// Writes assets/deal-pro-tutorial.mp4 and assets/deal-pro-tutorial-poster.png.
// Sign-in and the /api endpoints are replaced with demo responses, so nothing
// touches production and no account is needed.
import { createServer } from "node:http";
import { readFile, mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets");
const WORK = path.join(ROOT, ".tutorial-build");
const FRAMES = path.join(WORK, "frames");
const AUDIO = path.resolve(process.argv[2] || path.join(ROOT, "scripts", "tutorial-narration.mp3"));
const FPS = +process.env.FPS || 30;
const PREVIEW = +process.env.PREVIEW || 0; // e.g. PREVIEW=1 writes one frame a second and skips the video
const W = 1280, H = 720, SCALE = 1.5; // rendered at 1920x1080

function resolveModule(name) {
  try { return require.resolve(name); } catch {}
  const global = execFileSync("npm", ["root", "-g"]).toString().trim();
  return require.resolve(path.join(global, name));
}
const playwright = await import(resolveModule("playwright"));
const { chromium } = playwright.default ?? playwright;

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); } catch {}
  return "ffmpeg";
}
const FFMPEG = ffmpegPath();
const audioSeconds = (() => {
  const probe = (() => { try { execFileSync(FFMPEG, ["-i", AUDIO], { stdio: "pipe" }); return ""; } catch (e) { return String(e.stderr); } })();
  const m = probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Could not read the narration at ${AUDIO}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
})();

/* ---------- local server for the site ---------- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".mp4": "video/mp4", ".woff2": "font/woff2" };
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

/* ---------- demo data ---------- */
const html = await readFile(path.join(ROOT, "index.html"), "utf8");
const LISTINGS = JSON.parse(html.match(/const LISTINGS=(\[[\s\S]*?\n\]);/)[1]);
const idx = (id) => String(LISTINGS.findIndex((l) => l.id === id));

const CREDITS = { plan: "Pro", free: false, creditsLeft: 92, weeklyCredits: 100, resetsAt: "2026-10-01T09:00:00Z" };
const RANK = {
  summary: "Three W2 units stand out: rents well below the area median, close to Hyde Park and Paddington, where short-stay demand holds up all year.",
  picks: [
    { id: idx("1802560654"), score: 84, verdict: "Strong", reason: "The lowest studio rent in W2 in this search. Similar Bayswater studios take around £150 a night.", monthly_profit_80: "£1,025 a month" },
    { id: idx("2873501"), score: 78, verdict: "Good", reason: "A one-bed at a studio price on Queensway, which suits couples and longer stays.", monthly_profit_80: "£1,008 a month" },
    { id: idx("16851649"), score: 71, verdict: "Worth a look", reason: "Same landlord has three studios in Bayswater, so you could take more than one.", monthly_profit_80: "£750 a month" },
  ],
  watch_outs: ["London's 90-night limit applies without planning permission", "Get written consent for serviced accommodation"],
};
const ANALYSIS = {
  verdict: "Promising, with conditions",
  score: 71,
  summary: "Profitable from about 43% occupancy. It is in London, so the 90-night limit and the landlord's written consent decide whether it works.",
  monthly_profit: "£1,512 at 80%",
  upfront_cash: "£4,300",
  break_even: "43% occupancy",
  occupancy_scenarios: [
    { occupancy: "60%", monthly_profit: "£684" },
    { occupancy: "80%", monthly_profit: "£1,512" },
    { occupancy: "100%", monthly_profit: "£2,340" },
  ],
  stress_tests: [
    { scenario: "Nightly rate 15% lower", monthly_profit: "£824 at 80%", still_works: true },
    { scenario: "Capped at 90 nights a year", monthly_profit: "−£765 a month", still_works: false },
  ],
  risks: [
    "London's 90-night limit applies unless there is planning permission for year-round use.",
    "No written consent for serviced accommodation from the landlord, freeholder or lender yet.",
    "Islington's selective licensing may apply. Check whether it allows subletting.",
  ],
  assumptions: ["Platform fees of 15%, £45 cleaning per stay and a 3-night average stay.", "£150 a month for other running costs."],
  missing_information: ["The exact address and council tax band.", "Comparable N4 studio nightly rates and occupancy.", "Whether the bills include council tax."],
  next_actions: ["Ask the landlord for a signed agreement permitting serviced accommodation.", "Check the planning position with Islington Council.", "Pull N4 studio comparables before making an offer."],
};
const POSTS = [
  { id: "c1", title: "2 bed flat, landlord open to R2SA", strategy: "R2SA", propertyType: "Flat", beds: 2, contacted: "Landlord", location: "Ancoats, Manchester", postcode: "M4", price: 1350, priceType: "pcm", status: "Viewing booked", description: "Landlord is happy with a company let and serviced accommodation. Furnished, with parking.", contactName: "Priya S.", contactEmail: "priya@example.com", createdAt: "2026-09-22T10:00:00Z" },
  { id: "c2", title: "4 bed house, HMO-ready", strategy: "HMO", propertyType: "House", beds: 4, contacted: "Agent", location: "Headingley, Leeds", postcode: "LS6", price: 1600, priceType: "pcm", status: "Agent waiting on offers", description: "Two bathrooms, licence in place. Agent confirmed the landlord accepts sharers.", contactName: "Daniel O.", contactEmail: "daniel@example.com", createdAt: "2026-09-21T15:30:00Z" },
  { id: "c3", title: "3 bed terrace below market value", strategy: "BTL", propertyType: "House", beds: 3, contacted: "Landlord", location: "Wavertree, Liverpool", postcode: "L15", price: 145000, priceType: "purchase", status: "Owner wants a quick sale", description: "Needs a new kitchen. Similar terraces on the street sold for £170,000 this year.", contactName: "Sam K.", contactEmail: "sam@example.com", createdAt: "2026-09-20T09:10:00Z" },
];
const SAMPLE_AD = `Studio flat to rent, Islington N4 (Zone 2)
Fully furnished studio, open-plan bedroom
Rent + bills £1,650 a month (£19,800 a year)
Deposit £1,650
Nightly rate £180 (est.)
Landlord open to company lets`;

// Stand-in for assets/auth.js: starts signed out, and the sign-in form signs straight in.
const AUTH_STUB = `
const $ = (s) => document.querySelector(s);
document.body.classList.remove("auth-pending");
document.body.classList.add("signed-out", "simple-mode");
$("#authOauth").hidden = false;
$("#homeSignIn").addEventListener("click", () => { $("#authGate").hidden = false; });
$("#authForm").addEventListener("submit", (e) => {
  e.preventDefault();
  $("#authGate").hidden = true;
  document.body.classList.remove("signed-out");
  $(".ws-name").textContent = "Alex Morgan";
  $("#accountEmail").textContent = "alex@example.com";
  document.body.dataset.userId = "demo";
  document.body.dataset.userEmail = "alex@example.com";
  window.dispatchEvent(new Event("dealpro:signed-in"));
});`;

// A Premium account working on the Islington studio from the advert below, so every
// power level is available and the Numbers step matches the AI's figures.
const STATE = {
  plan: "Pro",
  deal: {
    id: "d100", name: "Islington N4 studio", area: "Islington, London N4", strat: "R2SA", london: true, status: "Checking",
    units: [{ label: "Studio", rent: 1650, dep: 1650, rate: 180 }], a: { fee: 15, clean: 45, stay: 3, other: 150 },
    dd: ["terms", "consent", "ninety", "licence", "tax", "location", "safety", "rates"].map((k) => ({ k, s: "none", n: "" })), ai: false,
    pack: { biz: "", redress: "", fee: "", nda: true, final: false },
    send: { co: "", email: "", addr: "", ll: "", role: "Owner / landlord", phone: "", lemail: "", use: "Serviced accommodation", docs: "Advert, photos, landlord emails" },
  },
  saved: [],
};

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

/* ---------- browser ---------- */
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
await page.route("**/assets/auth.js", (route) => route.fulfill({ contentType: "text/javascript", body: AUTH_STUB }));
await page.route("**/api/**", async (route) => {
  const req = route.request(), url = new URL(req.url());
  const json = (body) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname === "/api/community") return json({ posts: POSTS });
  if (url.pathname === "/api/analyze-deal") {
    if (req.method() === "POST") return json({ jobId: req.postDataJSON().kind, credits: CREDITS });
    const job = url.searchParams.get("job");
    if (job) return json({ status: "done", analysis: job === "rank" ? RANK : ANALYSIS, credits: CREDITS });
    return json(CREDITS);
  }
  return json({});
});
await page.addInitScript(`try{localStorage.setItem("dealpro:state",${JSON.stringify(JSON.stringify(STATE))});localStorage.setItem("dealpro:ai-level","quick");sessionStorage.clear()}catch(e){}`);
await page.addInitScript(CURSOR);
await page.clock.install({ time: new Date("2026-09-25T10:00:00") });
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
async function click() {
  await page.evaluate(() => { const c = document.getElementById("demoCursor"); c.classList.remove("ring"); void c.offsetWidth; c.classList.add("down", "ring"); });
  await shoot(); await shoot();
  await page.mouse.down(); await page.mouse.up();
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

/* ---------- the walkthrough, timed to the narration ---------- */
// 0.0  "Hi, and welcome to Deal Pro. Here's how to get started."
await until(1.9);
await move({ x: 700, y: 330 }, 1.1);
// 4.6  "Sign in with Google or your email, and you'll stay signed in on your device."
await until(3.4);
await moveClick("#homeSignIn", 1.0);
await move("#authGoogle", 0.9);
await until(6.7);
await moveClick("#authEmail", 0.5);
await type("alex@example.com", 0.7);
await moveClick("#authPassword", 0.35);
await type("password12", 0.3);
await moveClick("#authSubmit", 0.4);
// 9.3  "Before you search or analyse, choose a power level."
await until(9.6);
await moveClick('.tab[data-v="analyser"]', 0.8);
await until(11.2);
await move("#aiLevelOpts", 0.9, 0, -8);
// 12.7 "Scout gives you a fast first look and uses the least credits."
await until(12.9);
await moveClick("#aiLevelOpts .lv-quick", 0.5);
// 17.3 "Analyst gives you a full analysis and uses more."
await until(17.3);
await moveClick("#aiLevelOpts .lv-standard", 0.6);
// 20.5 "And Expert is thorough and stress-tested, and uses the most."
await until(20.6);
await moveClick("#aiLevelOpts .lv-deep", 0.6);
await until(23.1);
await moveClick("#aiLevelOpts .lv-standard", 0.6);
// 24.9 "Open Deal Finder, set your filters and search."
await until(24.9);
await moveClick('.tab[data-v="find"]', 0.7);
await until(25.9);
await moveClick("#fLoc", 0.6);
await type("W2", 0.3);
await scroll("#fSearch", 0.6, 520);
await moveClick("#fSearch", 0.6);
// 28.8 "Every result shows the full property details and a link to the listing, and the AI picks out the best deals for you."
await until(29.6);
await scroll(".sheet", 0.9, 150);
await move(".sheet tbody tr:nth-child(2) td.wide", 0.8);
await until(31.6);
await move(".sheet tbody tr:nth-child(2) .xlink", 0.7);
await until(33.4);
await scroll("#fResults", 0.8, 70);
await move(".rank-list li:first-child .rank-top b", 0.8);
await until(35.2);
await move(".rank-list li:first-child .rank-score", 0.6);
// 36.1 "You can copy them straight into Google Sheets."
await until(36.3);
await moveClick("#fCopy", 0.8);
// 39.6 "Next, open the AI Deal Analyser."
await until(39.6);
await moveClick('.tab[data-v="analyser"]', 0.8);
// 42.0 "Paste in an advert, or enter the rent, deposit and expected nightly rate yourself."
await until(42.0);
await moveClick("#aiDealInput", 0.7);
await until(43.1);
await page.keyboard.insertText(SAMPLE_AD);
await until(44.4);
await move("#aiDealInput", 0.6, 60, 20);
await scroll("#analyseWithAI", 0.8, 560);
await move("#analyseWithAI", 0.6);
// 47.7 "Deal Pro explains the likely profit at different occupancy levels, the key risks, and anything that's still missing, without simply guessing."
await until(47.5);
await click();
await until(49.9);
await scroll("#aiDealOutput", 0.9, 80);
await move("#aiDealOutput .ai-metric:first-child", 0.7);
await until(52.0);
await move("#aiDealOutput .ai-score strong", 0.6);
await scroll("#aiDealOutput .ai-metrics", 1.0, 40);
await until(54.2);
await scroll("#analyseWithAI", 1.0, 120);
await until(55.6);
// 56.4 "Then work through the due diligence checks, save the deal, and prepare the deal pack."
await moveClick("#advancedToggle", 0.7);
await scroll(".stepbar", 0.5, 20);
await moveClick('.stp[data-step="dd"]', 0.6);
await until(58.2);
await scroll(0, 0.5);
await moveClick("#saveDealTop", 0.7);
await until(59.3);
await scroll(".stepbar", 0.4, 20);
await moveClick('.stp[data-step="pack"]', 0.6);
// 61.8 "You can also use the Deal Community to post deals where you've already spoken to the landlord or agent, and to find deals other sourcers have contacted."
await until(62.2);
await moveClick('.tab[data-v="community"]', 0.8);
await until(63.6);
await moveClick("#cPostToggle", 0.8);
await until(66.3);
await moveClick("#cPostToggle", 0.6);
await move("#cResults .dcard:first-child h3", 0.8);
await until(68.6);
await move("#cResults .dcard:first-child .dc-act .btn", 0.7);
// 70.7 "And remember, always verify legal, planning, licensing and financial information independently."
await until(70.7);
await moveClick('.tab[data-v="home"]', 0.8);
await until(72.2);
await scroll(".home-foot", 1.8, 440);
await move(".home-foot p", 0.9);
await until(audioSeconds + 0.4);

await browser.close();
server.close();

/* ---------- encode ---------- */
if (PREVIEW) { console.log(`Preview frames in ${FRAMES}`); process.exit(0); }
const posterFrame = path.join(FRAMES, `${String(Math.round(2.6 * FPS)).padStart(5, "0")}.jpg`);
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", posterFrame, "-vf", `scale=${W}:${H}:flags=lanczos`, path.join(OUT, "deal-pro-tutorial-poster.png")]);
execFileSync(FFMPEG, [
  "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FRAMES, "%05d.jpg"), "-i", AUDIO,
  "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", path.join(OUT, "deal-pro-tutorial.mp4"),
], { stdio: "inherit" });
console.log(path.join(OUT, "deal-pro-tutorial.mp4"));
