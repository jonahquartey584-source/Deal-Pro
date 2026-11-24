// Qp Homebase "Ruby Edition" — core: data, sync with the home computer, navigation, themes.
import { startLiquid, setLiquidColours } from "./liquid.js";

export const VERSION = "1.4.0";
const LS_KEY = "qp-homebase-cache";

// ---------- helpers ----------
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDate = (s) => new Date(s + "T12:00");
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d); };
export const today = () => ymd();
export const weekday = (s) => toDate(s).getDay();
export const mondayOf = (s) => addDays(s, -((weekday(s) + 6) % 7));
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const fmtDate = (s, opts = { weekday: "short", day: "numeric", month: "short" }) => toDate(s).toLocaleDateString("en-GB", opts);
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
export const money = (n) => "£" + (Math.round((+n || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function dur(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// ---------- data ----------
export function defaults() {
  return {
    profile: { name: "RubyQp", welcomed: false }, theme: "pink-dark",
    tasks: [], routine: [], routineDone: {}, todos: [], journal: [],
    chores: [], choreDone: {},
    recipes: [], mealPlan: {}, shopping: { checked: {}, extra: [] }, calorieTarget: 2000,
    cycle: { periods: [], logs: {}, cycleLength: 28, periodLength: 5 },
    money: { tx: [], goals: [], budgets: {} },
    bible: { folders: [], notes: [], sessions: [], timer: null, goalMinutes: 15 },
    settings: { notify: false, bgVideo: true },
  };
}
function merge(base, d) {
  const out = { ...base, ...(d || {}) };
  for (const k of Object.keys(base)) if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = { ...base[k], ...(d?.[k] || {}) };
  return out;
}

export let S = defaults();
let rev = null, online = false, saveTimer = null, saving = false, pending = false;

function cache() { try { localStorage.setItem(LS_KEY, JSON.stringify({ rev, data: S })); } catch {} }
async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-Homebase": "1" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`); e.status = r.status; e.body = j; throw e; }
  return j;
}
export { api };

async function load() {
  try {
    const j = await api("GET", "/api/state");
    online = true;
    if (j.data) { S = merge(defaults(), j.data); rev = j.rev; }
    else {
      // first run: keep anything typed while offline
      try { const c = JSON.parse(localStorage.getItem(LS_KEY)); if (c?.data) S = merge(defaults(), c.data); } catch {}
      rev = j.rev; save(true);
    }
  } catch {
    online = false;
    try { const c = JSON.parse(localStorage.getItem(LS_KEY)); if (c?.data) { S = merge(defaults(), c.data); rev = c.rev; } } catch {}
  }
  cache();
}

export function save(now = false) {
  cache();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, now ? 0 : 400);
}
async function flush() {
  if (saving) { pending = true; return; }
  saving = true;
  try {
    const j = await api("PUT", "/api/state", { data: S, rev });
    rev = j.rev; online = true;
  } catch (e) {
    if (e.status === 409 && e.body?.current) {
      S = merge(defaults(), e.body.current.data); rev = e.body.current.rev; cache();
      toast("Updated with changes from your other device"); rerender();
    } else online = false;
  } finally {
    saving = false;
    if (pending) { pending = false; flush(); }
  }
}
export function replaceData(data, newRev) { S = merge(defaults(), data); if (newRev != null) rev = newRev; cache(); }
export function importData(data) { S = merge(defaults(), data); save(true); }

async function refresh() {
  if (saving || saveTimer && pending) return;
  try {
    const j = await api("GET", "/api/state");
    if (j.data && j.rev !== rev) { S = merge(defaults(), j.data); rev = j.rev; cache(); rerender(); }
    online = true;
  } catch { online = false; }
}

// ---------- UI helpers ----------
let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
export function openSheet(html, bind) {
  const sh = document.getElementById("sheet"), card = document.getElementById("sheetCard");
  card.innerHTML = html; sh.hidden = false;
  sh.onclick = (e) => { if (e.target === sh || e.target.closest("[data-close]")) closeSheet(); };
  bind?.(card);
  const f = card.querySelector("[autofocus]"); if (f) setTimeout(() => f.focus(), 50);
}
export function closeSheet() { document.getElementById("sheet").hidden = true; }
export const confirmBox = (msg) => window.confirm(msg);

// ---------- themes ----------
export const THEMES = [
  { id: "pink-dark", name: "Pink & black", a: "#ff5fa2", b: "#0b0709" },
  { id: "pink-light", name: "Pink & white", a: "#e0447f", b: "#fff4f8" },
  { id: "green-dark", name: "Green & black", a: "#3ddc84", b: "#050d09" },
  { id: "green-light", name: "Green & white", a: "#1f9d5c", b: "#f2fbf6" },
];
export function applyTheme(id) {
  if (!THEMES.some((t) => t.id === id)) id = "pink-dark";
  document.documentElement.dataset.theme = id;
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  document.querySelector('meta[name="theme-color"]').content = v("--bg");
  setLiquidColours([v("--blob1"), v("--blob2"), v("--blob3")], v("--bg"));
  setBackgroundVideo(id);
}
// Liquid-chrome loops made in OpenArt (Veo 3.1, 4K) per theme, 60fps, portrait.
// iPhones get HEVC (sharper for the size), everything else H.264. Switching
// theme crossfades between two video layers. The poster frame shows instantly
// (and stays if iOS Low Power Mode blocks autoplay); the canvas is a fallback.
let liquidOn = false;
function showLiquid() { const c = document.getElementById("liquid"); c.hidden = false; if (!liquidOn) { liquidOn = true; startLiquid(c); } }
const HEVC = (() => { try { const v = document.createElement("video"); return /probably|maybe/.test(v.canPlayType('video/mp4; codecs="hvc1"')); } catch { return false; } })();
let activeVideo = null;
function setBackgroundVideo(id) {
  const canvas = document.getElementById("liquid");
  const cur = activeVideo || document.getElementById("bgVideo");
  if (S.settings.bgVideo === false) { document.querySelectorAll(".bg-video").forEach((v) => { v.pause(); v.classList.remove("on"); }); showLiquid(); return; }
  const src = `media/${id}${HEVC ? ".hevc" : ""}.mp4`;
  if (cur.dataset.src === src && cur.classList.contains("on")) return;
  // first video: use the element in the page; later: a fresh layer on top that fades in
  const vid = cur.dataset.src ? cur.cloneNode(false) : cur;
  vid.removeAttribute("id"); vid.classList.add("bg-video"); vid.classList.remove("on");
  vid.muted = true; vid.playsInline = true; vid.loop = true;
  document.getElementById("bgPoster").style.backgroundImage = `url(media/${id}.jpg)`;
  vid.removeAttribute("poster"); vid.controls = false; vid.disablePictureInPicture = true; vid.dataset.src = src;
  if (vid !== cur) cur.after(vid);
  let tried264 = false;
  vid.onerror = () => {
    if (HEVC && !tried264) { tried264 = true; vid.src = `media/${id}.mp4`; vid.play().catch(() => {}); return; }
    vid.classList.remove("on"); showLiquid();
  };
  const show = () => {
    vid.classList.add("on"); canvas.hidden = true;
    if (vid !== cur) setTimeout(() => { cur.pause(); cur.remove(); }, 900);
  };
  vid.addEventListener("playing", show, { once: true });
  vid.src = src;
  activeVideo = vid;
  vid.play().catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) activeVideo?.play().catch(() => {}); });
// iOS only allows playback after a touch in some modes: retry on first tap.
document.addEventListener("touchstart", () => activeVideo?.play().catch(() => {}), { once: true, passive: true });
export function themeDots(container, onPick) {
  container.innerHTML = THEMES.map((t) => `<button class="theme-dot ${S.theme === t.id ? "on" : ""}" data-theme-id="${t.id}" title="${t.name}" aria-label="${t.name}" style="--a:${t.a};--b:${t.b}"></button>`).join("");
  container.onclick = (e) => {
    const b = e.target.closest("[data-theme-id]"); if (!b) return;
    S.theme = b.dataset.themeId; applyTheme(S.theme); save();
    container.querySelectorAll(".theme-dot").forEach((d) => d.classList.toggle("on", d === b));
    onPick?.();
  };
}

// ---------- routing ----------
const VIEWS = {
  home: () => import("./views/home.js"), planner: () => import("./views/planner.js"),
  todo: () => import("./views/todo.js"), house: () => import("./views/house.js"),
  meals: () => import("./views/meals.js"), cycle: () => import("./views/cycle.js"),
  money: () => import("./views/money.js"), bible: () => import("./views/bible.js"),
  journal: () => import("./views/journal.js"), jay: () => import("./views/jay.js"),
  settings: () => import("./views/settings.js"), more: () => import("./views/more.js"),
};
const TAB_OF = { home: "home", planner: "planner", meals: "meals", money: "money" };
let current = { name: "home", params: {} }, cleanup = null;

export async function go(name, params = {}, push = true, animate = true) {
  if (!VIEWS[name]) name = "home";
  cleanup?.(); cleanup = null;
  current = { name, params };
  if (push) history.pushState({ name, params }, "", "#" + name);
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.go === (TAB_OF[name] || "more")));
  document.getElementById("backBtn").hidden = ["home", "planner", "meals", "money", "more"].includes(name);
  const mod = await VIEWS[name]();
  const el = document.getElementById("view");
  el.onclick = el.oninput = el.onchange = el.onsubmit = null;
  document.getElementById("viewTitle").textContent = mod.title || "Homebase";
  document.getElementById("viewSub").textContent = mod.subtitle ? mod.subtitle() : "";
  cleanup = mod.render(el, params) || null;
  if (animate) {
    window.scrollTo({ top: 0 });
    el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter");
  }
}
export function rerender() {
  const y = window.scrollY;
  go(current.name, current.params, false, false).then(() => window.scrollTo({ top: y }));
}
export function setParams(p) { current.params = { ...current.params, ...p }; rerender(); }

// ---------- welcome ----------
const LINES = [
  "Let's make today a soft and productive one.", "You've got this. One step at a time.",
  "Plan it, live it, love it.", "Grace for today, plans for tomorrow.", "Small steps still move you forward.",
];
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function showWelcome() {
  const w = document.getElementById("welcome");
  document.getElementById("welcomeHello").textContent = "Welcome RubyQp";
  document.getElementById("welcomeLine").textContent = `${greeting()} · ${LINES[new Date().getDate() % LINES.length]}`;
  themeDots(document.getElementById("welcomeDots"));
  w.hidden = false;
  document.getElementById("app").hidden = true;
  document.getElementById("welcomeGo").onclick = () => {
    S.profile.welcomed = true; save();
    sessionStorage.setItem("qp-welcomed", "1");
    w.classList.add("leaving");
    setTimeout(() => { w.hidden = true; w.classList.remove("leaving"); }, 450);
    document.getElementById("app").hidden = false;
    go(location.hash.slice(1) || "home", {}, false);
  };
}

// ---------- reminders ----------
const notified = new Set();
function reminderTick() {
  if (!S.settings.notify || !("Notification" in window) || Notification.permission !== "granted") return;
  const t = today(), now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  const items = [
    ...S.tasks.filter((x) => x.date === t && !x.done),
    ...S.routine.filter((x) => x.days?.includes(weekday(t)) && !S.routineDone[`${t}|${x.id}`]),
  ];
  for (const x of items) {
    if (!x.start) continue;
    const [h, m] = x.start.split(":").map(Number), at = h * 60 + m, key = `${t}|${x.id}`;
    if (at - mins <= 5 && at - mins >= 0 && !notified.has(key)) {
      notified.add(key);
      try { new Notification("Qp Homebase Ruby Edition", { body: `${x.start} · ${x.title}`, icon: "icon-180.png" }); } catch {}
    }
  }
}

// ---------- boot ----------
async function boot() {
  await load();
  applyTheme(S.theme);
  document.getElementById("tabs").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
  document.querySelector(".top").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); };
  document.getElementById("backBtn").onclick = () => history.length > 1 ? history.back() : go("more");
  window.onpopstate = (e) => go(e.state?.name || location.hash.slice(1) || "home", e.state?.params || {}, false);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
  setInterval(reminderTick, 30000);
  if (!sessionStorage.getItem("qp-welcomed")) showWelcome();
  else { document.getElementById("app").hidden = false; go(location.hash.slice(1) || "home", {}, false); }
  if (!online) setTimeout(() => toast("Working offline — changes will sync when your computer is reachable"), 800);
  history.replaceState({ name: location.hash.slice(1) || "home", params: {} }, "");
}
boot();
