// Qp Homebase "Ruby Edition" — core: data, sync with the home computer, navigation, themes.
import { startLiquid, setLiquidColours } from "./liquid.js";
import { icon } from "./icons.js";
import { lockConfig, isLocked, unlockWithFaceId, unlockWithPin, LOCKABLE } from "./lock.js";
export { icon };

export const VERSION = "1.7.0";
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

// ---------- storage: her iPhone is the home of her data ----------
// Everything is saved on the device (IndexedDB), so the app works with the Mac
// off and with no internet. When the Mac is reachable, the phone copies her
// data to it as a backup (and picks up anything changed on the Mac).
const DB = "ruby-homebase";
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function idbGet(key) {
  try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  catch { try { return JSON.parse(localStorage.getItem("rh-" + key)); } catch { return undefined; } }
}
export async function idbSet(key, value) {
  try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(value, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  catch { try { localStorage.setItem("rh-" + key, JSON.stringify(value)); } catch {} }
}

let meta = { savedAt: null, backedUpSavedAt: null, backedUpAt: null, serverSavedAt: null };
let macReachable = false, writeTimer = null, backupTimer = null, syncing = false;
export const backupStatus = () => ({ macReachable, backedUpAt: meta.backedUpAt, pending: meta.savedAt !== meta.backedUpSavedAt });

async function api(method, path, body, timeoutMs = 6000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(path, { method, signal: ctl.signal, headers: { "Content-Type": "application/json", "X-Homebase": "1" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`); e.status = r.status; e.body = j; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
export { api };

const persist = () => idbSet("state", { data: S, ...meta });

async function load() {
  let local = await idbGet("state");
  if (!local) { // updating from an older version: its phone copy is only a cache, the Mac copy wins
    try { const c = JSON.parse(localStorage.getItem(LS_KEY)); if (c?.data) { const t = new Date(0).toISOString(); local = { data: c.data, savedAt: t, backedUpSavedAt: t, serverSavedAt: null }; } } catch {}
  }
  if (local?.data) {
    S = merge(defaults(), local.data);
    meta = { savedAt: local.savedAt || null, backedUpSavedAt: local.backedUpSavedAt || null, backedUpAt: local.backedUpAt || null, serverSavedAt: local.serverSavedAt || null };
    syncWithMac(); // in the background: the app opens straight away
  } else {
    // first time on this phone: bring over anything already saved on the Mac
    try {
      const j = await api("GET", "/api/state", null, 4000); macReachable = true;
      if (j.data) { S = merge(defaults(), j.data); meta = { savedAt: j.savedAt, backedUpSavedAt: j.savedAt, backedUpAt: new Date().toISOString(), serverSavedAt: j.savedAt }; }
    } catch { macReachable = false; }
    await persist();
  }
  try { navigator.storage?.persist?.(); } catch {} // ask the phone to never clear it
}

export function save() {
  meta.savedAt = new Date().toISOString();
  clearTimeout(writeTimer); writeTimer = setTimeout(persist, 150);
  clearTimeout(backupTimer); backupTimer = setTimeout(syncWithMac, 2000);
}
export function flushNow() { clearTimeout(writeTimer); return persist(); }

async function syncWithMac() {
  if (syncing) return; syncing = true;
  try {
    if (meta.savedAt && meta.savedAt !== meta.backedUpSavedAt) {
      const savedAt = meta.savedAt;
      const r = await api("PUT", "/api/state", { data: S, force: true });
      meta.backedUpSavedAt = savedAt; meta.serverSavedAt = r.savedAt || meta.serverSavedAt;
    } else {
      const j = await api("GET", "/api/state");
      // changed on the Mac (e.g. in its browser) since this phone last synced? take it
      if (j.data && j.savedAt && j.savedAt !== meta.serverSavedAt && meta.savedAt === meta.backedUpSavedAt) {
        S = merge(defaults(), j.data); meta.savedAt = meta.backedUpSavedAt = meta.serverSavedAt = j.savedAt; rerender();
      } else if (j.savedAt) meta.serverSavedAt = j.savedAt;
    }
    macReachable = true; meta.backedUpAt = new Date().toISOString(); await persist();
  } catch { macReachable = false; }
  finally { syncing = false; }
}
export function replaceData(data) { S = merge(defaults(), data); save(); }
export function importData(data) { S = merge(defaults(), data); save(); flushNow(); }
const refresh = () => syncWithMac();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { flushNow(); } });
window.addEventListener("pagehide", () => flushNow());

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
  const src = `media/${id}${HEVC ? ".hevc" : ""}.mp4?v=${VERSION}`;
  if (cur.dataset.src === src && cur.classList.contains("on")) return;
  // first video: use the element in the page; later: a fresh layer on top that fades in
  const vid = cur.dataset.src ? cur.cloneNode(false) : cur;
  vid.removeAttribute("id"); vid.classList.add("bg-video"); vid.classList.remove("on");
  vid.muted = true; vid.playsInline = true; vid.loop = true;
  document.getElementById("bgPoster").style.backgroundImage = `url(media/${id}.jpg?v=${VERSION})`;
  vid.removeAttribute("poster"); vid.controls = false; vid.disablePictureInPicture = true; vid.dataset.src = src;
  if (vid !== cur) cur.after(vid);
  let tried264 = false;
  vid.onerror = () => {
    if (HEVC && !tried264) { tried264 = true; vid.src = `media/${id}.mp4?v=${VERSION}`; vid.play().catch(() => {}); return; }
    vid.classList.remove("on"); showLiquid();
  };
  const show = () => {
    vid.classList.add("on"); canvas.hidden = true;
    if (vid !== cur) setTimeout(() => { cur.pause(); cur.remove(); }, 900);
  };
  vid.addEventListener("playing", show, { once: true });
  // the still frame shows instantly; the video only starts downloading once the app is up
  const start = () => { vid.src = src; vid.play().catch(() => {}); };
  if (document.readyState === "complete") start(); else window.addEventListener("load", () => setTimeout(start, 150), { once: true });
  activeVideo = vid;
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
  moveTabPill();
  document.getElementById("backBtn").hidden = ["home", "planner", "meals", "money", "more"].includes(name);
  const el = document.getElementById("view");
  await lockConfig();
  if (isLocked(name)) { el.onclick = el.oninput = el.onchange = el.onsubmit = null; return showLockScreen(el, name, params, animate); }
  const mod = await VIEWS[name]();
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

// ---------- Face ID lock screen for private sections ----------
async function showLockScreen(el, name, params, animate) {
  const cfg = await lockConfig();
  document.getElementById("viewTitle").textContent = LOCKABLE[name] || "Private";
  document.getElementById("viewSub").textContent = "Private";
  el.innerHTML = `<div class="card lock-card">
      <div class="lock-ico">${icon("lock")}</div>
      <h2>${esc(LOCKABLE[name] || "This section")} is private</h2>
      <p class="muted small">Unlock with Face ID to open it. It locks again when you leave the app.</p>
      ${cfg.credId ? `<button class="btn primary wide" id="unlockFace">${icon("faceid")} Unlock with Face ID</button>` : ""}
      ${cfg.pinHash ? `<form id="pinForm" class="row" style="margin-top:12px;width:100%;max-width:320px"><input class="input grow center" id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="Passcode"><button class="btn">Unlock</button></form>` : ""}
      <p class="small" id="lockErr" style="color:var(--bad);min-height:1.2em;margin:8px 0 0"></p>
    </div>`;
  if (animate) { window.scrollTo({ top: 0 }); el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); }
  const done = () => go(name, params, false);
  const fail = (e) => (el.querySelector("#lockErr").textContent = e?.name === "NotAllowedError" ? "Face ID was cancelled. Try again." : e?.message || "Couldn't unlock");
  el.querySelector("#unlockFace")?.addEventListener("click", () => unlockWithFaceId().then(done, fail));
  el.querySelector("#pinForm")?.addEventListener("submit", (e) => { e.preventDefault(); unlockWithPin(el.querySelector("#pin").value).then(done, fail); });
}

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
      try { new Notification("Qp Homebase Ruby Edition", { body: `${x.start} · ${x.title}`, icon: "ruby-icon-180.png" }); } catch {}
    }
  }
}

// sliding glass highlight behind the selected tab
function moveTabPill() {
  const nav = document.getElementById("tabs"), on = nav.querySelector("button.on"), pill = nav.querySelector(".tab-pill");
  if (!on || !pill) return;
  const r = on.getBoundingClientRect(), n = nav.getBoundingClientRect();
  if (!r.width) return void setTimeout(moveTabPill, 250);
  pill.style.width = r.width + "px"; pill.style.transform = `translateX(${r.left - n.left}px)`;
}
window.addEventListener("resize", moveTabPill);
// large title shrinks into the bar as you scroll
window.addEventListener("scroll", () => document.body.classList.toggle("scrolled", window.scrollY > 24), { passive: true });

// ---------- instant loading ----------
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // after an update, switch to the new version once (quietly, only before she starts using the page)
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && !document.getElementById("welcome").hidden) location.reload(); });
}

// ---------- boot ----------
async function boot() {
  document.querySelectorAll("#tabs button[data-icon]").forEach((b) => b.insertAdjacentHTML("afterbegin", icon(b.dataset.icon)));
  document.getElementById("backBtn").innerHTML = icon("back");
  document.getElementById("settingsBtn").innerHTML = icon("settings");
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
  history.replaceState({ name: location.hash.slice(1) || "home", params: {} }, "");
}
boot();
