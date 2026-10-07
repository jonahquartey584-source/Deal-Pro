// Renders the motion-graphics "What Deal Pro does" video from scripts/motion/overview.html,
// frame by frame, then encodes it with the narration in two shapes:
//   assets/deal-pro-overview.mp4           16:9 for the website (plus a poster)
//   assets/deal-pro-overview-vertical.mp4  9:16 for TikTok, Reels and Shorts: the video in the
//                                          middle over a blurred copy, with a caption and the brand
//
//   npm i -g playwright geist @fontsource/instrument-serif && pip3 install imageio-ffmpeg
//   node scripts/record_motion.mjs [narration.mp3] [--caption "The numbers, done for you ✅"]
//
// PREVIEW=1 writes two frames a second to .tutorial-build/frames and skips the videos.
import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
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
const args = process.argv.slice(2);
const capIdx = args.indexOf("--caption");
const CAPTION = capIdx >= 0 ? args.splice(capIdx, 2)[1] : "The numbers, done for you ✅";
const AUDIO = path.resolve(args[0] || path.join(ROOT, "scripts", "overview-narration.mp3"));
const FPS = 30, PREVIEW = +process.env.PREVIEW || 0;

function resolveModule(name) {
  try { return require.resolve(name); } catch {}
  const global = execFileSync("npm", ["root", "-g"]).toString().trim();
  return require.resolve(path.join(global, name));
}
const FFMPEG = process.env.FFMPEG || (() => { try { return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); } catch { return "ffmpeg"; } })();
const duration = (() => {
  let err = ""; try { execFileSync(FFMPEG, ["-i", AUDIO], { stdio: "pipe" }); } catch (e) { err = String(e.stderr); }
  const m = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`Could not read the narration at ${AUDIO}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
})();

// Fonts: Geist from the geist package, Instrument Serif from @fontsource/instrument-serif.
const FONTS = {
  "Geist-Variable.woff2": path.join(path.dirname(resolveModule("geist/package.json")), "dist", "fonts", "geist-sans", "Geist-Variable.woff2"),
  "instrument-serif-latin-400-italic.woff2": path.join(path.dirname(resolveModule("@fontsource/instrument-serif/package.json")), "files", "instrument-serif-latin-400-italic.woff2"),
};
const MOTION = path.join(ROOT, "scripts", "motion");
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = p.startsWith("/__fonts/") ? FONTS[p.slice(9)] : path.join(MOTION, path.normalize(p));
  if (!file || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": file.endsWith(".woff2") ? "font/woff2" : "text/html" });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const playwright = await import(resolveModule("playwright"));
const { chromium } = playwright.default ?? playwright;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.warn("page error:", e.message));
await page.goto(`${BASE}/overview.html`);
await page.evaluate(() => document.fonts.ready);

await rm(WORK, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });
const total = Math.ceil((duration + 0.6) * FPS);
for (let f = 0; f < total; f++) {
  if (PREVIEW && f % (FPS / 2)) continue;
  await page.evaluate((t) => window.render(t), f / FPS);
  await page.screenshot({ path: path.join(FRAMES, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
}

// The 9:16 frame around the video: caption above, brand below (transparent PNG).
const chrome = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await chrome.goto(`${BASE}/overview.html`); // for the fonts
await chrome.setContent(`<!doctype html><html><head><style>
@font-face{font-family:Geist;font-weight:100 900;src:url(${BASE}/__fonts/Geist-Variable.woff2) format("woff2")}
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:Geist,"Noto Color Emoji",sans-serif;color:#fff}
.shade{position:absolute;left:0;right:0}
.cap{position:absolute;left:0;right:0;top:330px;text-align:center;font-size:66px;font-weight:800;letter-spacing:-.02em;text-shadow:0 4px 24px rgba(0,0,0,.55)}
.brand{position:absolute;left:0;right:0;top:1400px;display:flex;justify-content:center;align-items:center;gap:20px;font-size:64px;font-weight:800;letter-spacing:-.03em;text-shadow:0 4px 24px rgba(0,0,0,.45)}
.url{position:absolute;left:0;right:0;top:1530px;text-align:center}
.url span{display:inline-block;background:#E0142B;color:#fff;font-size:42px;font-weight:700;padding:18px 44px;border-radius:16px;box-shadow:0 18px 40px rgba(224,20,43,.45)}
</style></head><body>
<div class="shade" style="top:0;height:640px;background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.05))"></div>
<div class="shade" style="top:1270px;height:650px;background:linear-gradient(rgba(0,0,0,.05),rgba(0,0,0,.4))"></div>
<div class="cap">${CAPTION.replace(/</g, "&lt;")}</div>
<div class="brand"><svg width="76" height="76" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#E0142B"/><path d="M6 5h3.6a5 5 0 0 1 0 10H6z" fill="#fff"/><rect x="6" y="9" width="4" height="2" fill="#E0142B"/></svg>Deal Pro</div>
<div class="url"><span>usedealpro.com</span></div>
</body></html>`);
await chrome.evaluate(() => document.fonts.ready);
const CHROME_PNG = path.join(WORK, "vertical-frame.png");
await chrome.screenshot({ path: CHROME_PNG, omitBackground: true });
await browser.close();
server.close();

if (PREVIEW) { console.log(`Preview frames in ${FRAMES}`); process.exit(0); }

const posterAt = 20.6; // the strategy tiles
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", path.join(FRAMES, `${String(Math.round(posterAt * FPS)).padStart(5, "0")}.jpg`), "-vf", "scale=1280:720:flags=lanczos", path.join(OUT, "deal-pro-overview-poster.png")]);
const frames = ["-framerate", String(FPS), "-i", path.join(FRAMES, "%05d.jpg")];
const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart"];
execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...frames, "-i", AUDIO, ...enc, path.join(OUT, "deal-pro-overview.mp4")], { stdio: "inherit" });
execFileSync(FFMPEG, ["-y", "-loglevel", "error", ...frames, "-i", CHROME_PNG, "-i", AUDIO,
  "-filter_complex", "[0:v]split=2[a][b];[a]scale=3414:1920,crop=1080:1920,boxblur=36:3,eq=brightness=-0.05:saturation=0.85[bg];[b]scale=1080:608:flags=lanczos[fg];[bg][fg]overlay=0:656[m];[m][1:v]overlay=0:0,setsar=1,format=yuv420p[v]",
  "-map", "[v]", "-map", "2:a", ...enc, path.join(OUT, "deal-pro-overview-vertical.mp4")], { stdio: "inherit" });
console.log(path.join(OUT, "deal-pro-overview.mp4"));
console.log(path.join(OUT, "deal-pro-overview-vertical.mp4"));
