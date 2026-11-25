// Jay: talk to your assistant. Built from Qp Homebase's Jay (public/app.js,
// Jay's parts): the floating orb, the full-screen Jay view, speaking while he
// writes, listening with the phone's own speech recognition, follow-up
// questions and an optional "Hey Jay". Speech recognition is done by the
// phone, so nothing she says is recorded; only the words go to OpenAI.
import { S, esc, today, nowHM, replaceData, idbGet, idbSet } from "./app.js";
import { runAssistant, speechClip } from "./assistant.js";
import { mount } from "./jayorb.js";
import { isLocked, LOCKABLE } from "./lock.js";

const $ = (s) => document.querySelector(s);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const jay = { open: false, rec: null, phase: "idle", followUp: false, level: 0, chat: [], clipToken: 0, wake: null };
export const jaySettingsDefaults = { apiKey: "", model: "", speak: true, voice: "onyx", speed: "quick", wake: false };
let cfg = { ...jaySettingsDefaults };
export async function loadJaySettings() { cfg = { ...jaySettingsDefaults, ...((await idbGet("jay")) || {}) }; if (cfg.model?.startsWith("claude")) cfg.model = ""; return cfg; }
export async function saveJaySettings(next) { cfg = { ...cfg, ...next }; await idbSet("jay", cfg); if (cfg.wake) startWake(); else stopWake(); return cfg; }
export const jaySettings = () => cfg;

// ---------- markup ----------
function md(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .split(/\n{2,}/).map((p) => /^\s*[-•] /m.test(p) ? `<ul>${p.split("\n").map((l) => l.replace(/^\s*[-•]\s+/, "")).filter(Boolean).map((l) => `<li>${l}</li>`).join("")}</ul>` : `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
function speakable(text) {
  return String(text || "").replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|~]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s+/g, " ").trim();
}

// ---------- the view ----------
function build() {
  if ($("#jay")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <button class="jay-fab" id="jayFab" type="button" aria-label="Talk to Jay"><canvas class="jay-holo" id="jayFabCanvas" aria-hidden="true"></canvas></button>
  <div class="jay" id="jay" role="dialog" aria-modal="true" aria-label="Jay" hidden>
    <button class="jay-x" id="jayClose" type="button" aria-label="Close">✕</button>
    <div class="jay-name">JAY</div>
    <button class="jay-orb" id="jayOrb" type="button" aria-label="Tap to talk"><canvas class="jay-holo" id="jayBigCanvas" aria-hidden="true"></canvas></button>
    <p class="jay-state" id="jayState">Tap the orb to talk</p>
    <p class="jay-heard" id="jayHeard"></p>
    <div class="jay-reply" id="jayReply"></div>
    <form class="jay-type" id="jayType" autocomplete="off"><input id="jayTypeInput" placeholder="Or type to Jay…" aria-label="Type to Jay" enterkeyhint="send"></form>
    <p class="jay-model" id="jayModel"></p>
    <button type="button" class="jay-close-bottom" id="jayCloseBottom">Close</button>
  </div>`);
  const state = () => jay.phase, level = () => { jay.level *= 0.9; return jay.level; };
  mount($("#jayFabCanvas"), { state, level, detail: 1 });
  mount($("#jayBigCanvas"), { state, level, detail: 1 });
  $("#jayFab").onclick = () => (jay.open ? closeJay() : openJay());
  $("#jayOrb").onclick = () => { if (jay.phase === "listening") { try { jay.rec?.stop(); } catch { /* fine */ } } else if (jay.phase === "speaking") { stopSpeaking(); jayPhase("idle"); } else jayListen(); };
  $("#jayClose").onclick = $("#jayCloseBottom").onclick = closeJay;
  $("#jayType").onsubmit = (e) => { e.preventDefault(); const v = $("#jayTypeInput").value; $("#jayTypeInput").value = ""; askJay(v, { voice: false }); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && jay.open) closeJay(); });
}
function jayPhase(phase, label) {
  jay.phase = phase;
  $("#jay").dataset.phase = phase; $("#jayFab").dataset.phase = phase;
  $("#jayState").textContent = label ?? { idle: SR ? "Tap the orb to talk" : "Type to Jay below", listening: "Listening…", thinking: "Thinking…", speaking: "" }[phase] ?? "";
}
export async function openJay({ listen = false, ask } = {}) {
  build(); await loadJaySettings();
  if (!jay.open) {
    jay.open = true; $("#jay").hidden = false; document.body.classList.add("jay-open");
    requestAnimationFrame(() => $("#jay").classList.add("show"));
    $("#jayHeard").textContent = ""; $("#jayReply").innerHTML = jay.chat.length ? md(jay.chat[jay.chat.length - 1].content) : `<p class="jay-hello">Hi Ruby 💕 I'm Jay. Ask me anything, or tell me what to add.</p>`;
  }
  if (!cfg.apiKey) { jayPhase("idle", "Jay needs an OpenAI API key first: add it in Settings ⚙︎ → Jay."); return; }
  if (ask) return askJay(ask, { voice: false });
  if (listen && SR) jayListen(); else jayPhase("idle");
}
export function closeJay() {
  if (!jay.open) return;
  jay.open = false; jay.followUp = false;
  try { jay.rec?.abort(); } catch { /* fine */ }
  stopSpeaking();
  $("#jay").classList.remove("show"); document.body.classList.remove("jay-open");
  jayPhase("idle");
  setTimeout(() => { if (!jay.open) $("#jay").hidden = true; }, 350);
  startWake();
}

// ---------- voice out ----------
const player = new Audio(); player.preload = "auto"; player.setAttribute("playsinline", "");
let unlocked = false;
function silentWav() {
  const b = new ArrayBuffer(46), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 38, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, 2, true); v.setInt16(44, 0, true);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}
// iPhone only lets a page play sound after a tap: the first tap unlocks Jay's player.
function unlockPlayer() { if (unlocked) return; unlocked = true; try { player.src = silentWav(); player.play().catch(() => { unlocked = false; }); } catch { unlocked = false; } }
for (const ev of ["pointerdown", "touchend", "keydown"]) addEventListener(ev, unlockPlayer, { capture: true, passive: true });
function stopSpeaking() { if ("speechSynthesis" in window) speechSynthesis.cancel(); jay.clipToken++; try { player.pause(); } catch { /* fine */ } }
function playClip(url, token) {
  return new Promise((resolve, reject) => {
    player.onended = () => { URL.revokeObjectURL(url); resolve(); };
    player.onerror = () => reject(new Error("Couldn't play Jay's voice"));
    player.src = url;
    const pulse = setInterval(() => { if (player.paused || jay.clipToken !== token) clearInterval(pulse); else jay.level = 0.45 + Math.random() * 0.55; }, 110);
    player.play().catch(reject);
  });
}
const MALE_VOICES = ["Daniel", "Arthur", "Oliver", "Aaron", "Alex", "Tom", "Evan", "Nathan", "Reed", "Rishi", "Fred", "Ralph", "Google UK English Male"];
function pickVoice() {
  const all = ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => /^en/i.test(v.lang));
  const rank = (v) => { let r = MALE_VOICES.findIndex((n) => v.name.startsWith(n)); r = r < 0 ? 100 : r; if (/premium|enhanced|neural/i.test(v.name)) r -= 0.5; if (/GB/.test(v.lang)) r -= 0.2; return r; };
  return all.sort((a, b) => rank(a) - rank(b))[0] || null;
}
function builtInSpeak(words, onDone) {
  if (!("speechSynthesis" in window)) return onDone?.();
  const parts = words.match(/[^.!?]+[.!?]*\s*/g) || [words], voice = pickVoice();
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.trim());
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = { normal: 1, quick: 1.1, fast: 1.22 }[cfg.speed] || 1.1; u.pitch = 0.9;
    u.onboundary = () => { jay.level = 1; };
    if (i === parts.length - 1) u.onend = () => onDone?.();
    speechSynthesis.speak(u);
  });
}
// Jay talks while he writes: each finished sentence is turned into speech straight away.
function streamTalker(onDone) {
  stopSpeaking();
  const token = jay.clipToken, on = cfg.speak, natural = on && !!cfg.apiKey;
  let buf = "", all = "", ended = false, playing = false, finished = false, failed = false;
  const queue = [];
  const finish = () => { if (finished) return; finished = true; if (jay.clipToken === token) onDone?.(); };
  const pump = () => {
    if (jay.clipToken !== token || playing) return;
    if (!queue.length) { if (ended) finish(); return; }
    playing = true;
    queue.shift().then((url) => (jay.clipToken === token ? playClip(url, token) : null))
      .catch((err) => { if (!failed) { failed = true; if (err.name !== "NotAllowedError") console.warn("voice:", err.message); } })
      .finally(() => { playing = false; pump(); });
  };
  const say = (piece) => { const w = speakable(piece); if (w && natural && !failed) { queue.push(speechClip(cfg.apiKey, w, cfg.voice, cfg.speed)); pump(); } };
  const cut = (final) => {
    for (;;) {
      const re = /[.!?…]["')\]]*\s+/g, min = queue.length || playing ? 50 : 12;
      let m, end = -1;
      while ((m = re.exec(buf))) { end = m.index + m[0].length; if (end >= min) break; }
      if (end < 0 || end < min) break;
      say(buf.slice(0, end)); buf = buf.slice(end);
    }
    if (final && buf.trim()) { say(buf); buf = ""; }
  };
  return {
    push(d) { all += d; buf += d; if (natural) cut(false); },
    end() {
      ended = true;
      if (!on) return finish();
      if (natural && !failed) { cut(true); pump(); return; }
      builtInSpeak(speakable(all), finish);
    },
    cancel() { stopSpeaking(); },
  };
}

// ---------- voice in ----------
function chime(up = true) {
  try {
    jay.ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = jay.ac.currentTime;
    [up ? 660 : 880, up ? 880 : 660].forEach((f, i) => {
      const o = jay.ac.createOscillator(), g = jay.ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.08, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.25);
      o.connect(g).connect(jay.ac.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  } catch { /* no sound */ }
}
function jayListen() {
  stopSpeaking(); stopWake();
  if (!cfg.apiKey) { jayPhase("idle", "Jay needs an OpenAI API key first: add it in Settings ⚙︎ → Jay."); return; }
  if (!SR) { jayPhase("idle", "Voice isn't available here. Type to Jay below."); $("#jayTypeInput").focus(); return; }
  try { jay.rec?.abort(); } catch { /* fine */ }
  const rec = new SR(); jay.rec = rec;
  rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let finalText = "";
  const finish = () => { clearTimeout(rec.pauseTimer); clearTimeout(rec.capTimer); try { rec.stop(); } catch { /* fine */ } };
  rec.capTimer = setTimeout(finish, 15000); rec.pauseTimer = setTimeout(finish, 7000);
  rec.onresult = (e) => {
    clearTimeout(rec.pauseTimer); rec.pauseTimer = setTimeout(finish, 1000);
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    $("#jayHeard").textContent = (finalText + interim).trim(); jay.level = 0.8;
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") jayPhase("idle", "The microphone is off for this app. Allow it in iPhone Settings → Safari → Microphone, or type below.");
    else if (e.error === "no-speech") { if (jay.followUp) jayPhase("idle", "Tap the orb to ask something else"); else jayPhase("idle", "I didn't catch that. Tap the orb and try again."); }
    else if (e.error !== "aborted") jayPhase("idle", "Voice stopped. Tap the orb to try again.");
  };
  rec.onend = () => {
    clearTimeout(rec.pauseTimer); clearTimeout(rec.capTimer);
    if (jay.rec !== rec) return;
    const text = finalText.trim() || $("#jayHeard").textContent.trim();
    if (text && jay.phase === "listening") askJay(text, { voice: true });
    else if (jay.phase === "listening") jayPhase("idle", jay.followUp ? "Tap the orb to ask something else" : undefined);
  };
  $("#jayHeard").textContent = ""; jayPhase("listening"); chime(true);
  try { rec.start(); } catch { jayPhase("idle"); }
}

// ---------- asking ----------
export async function askJay(text, { voice = false } = {}) {
  text = String(text || "").trim(); if (!text) return;
  if (/^(stop|cancel|never ?mind|that'?s all|thanks,? that'?s all|goodbye|bye)\.?$/i.test(text)) { closeJay(); return; }
  if (!jay.open) await openJay();
  if (!cfg.apiKey) return;
  $("#jayHeard").textContent = text; $("#jayReply").innerHTML = ""; $("#jayModel").textContent = "";
  jayPhase("thinking"); jay.followUp = false;
  jay.chat.push({ role: "user", content: text });
  const talker = streamTalker(afterTalking);
  let shown = "", res;
  try {
    const hidden = Object.keys(LOCKABLE).filter(isLocked);
    res = await runAssistant({
      apiKey: cfg.apiKey, model: cfg.model, messages: jay.chat, data: S, today: today(), now: nowHM(), voice, hidden,
      onDelta: (d) => { if (!jay.open) return; if (!shown) jayPhase("speaking"); shown += d; $("#jayReply").innerHTML = md(shown); talker.push(d); },
    });
    if (res.changed && res.data) { replaceData(res.data); window.dispatchEvent(new CustomEvent("jay-changed")); }
  } catch (err) {
    res = { reply: err.status === 401 ? "OpenAI rejected the API key. Check it in Settings ⚙︎ → Jay (it starts with sk-)." : err.message };
  }
  const reply = res.reply || shown || "Sorry, I didn't get a reply. Try again in a moment.";
  jay.chat.push({ role: "assistant", content: reply });
  if (!jay.open) { talker.cancel(); return; }
  $("#jayReply").innerHTML = md(reply);
  if (res.model) $("#jayModel").textContent = res.model.split(" → ").map((m) => m.replace(/^gpt-/, "")).join(" → ");
  jayPhase("speaking");
  if (!shown) talker.push(reply);
  talker.end();
  function afterTalking() {
    if (!jay.open) return;
    if (!voice || !cfg.speak || !SR) { jayPhase("idle", "Tap the orb to ask something else"); return; }
    jay.followUp = true; jayListen(); // like Alexa's follow-up mode
  }
}

// ---------- "Hey Jay" (optional) ----------
function wakeMatch(t) { const m = String(t).toLowerCase().match(/\b(?:hey|hi|ok|okay|a)[ ,]*(?:jay|j|jai|jae|jade)\b[ ,.!?]*(.*)$/); return m ? m[1] || "" : null; }
function startWake() {
  if (!SR || !cfg.wake || !cfg.apiKey || document.hidden || jay.wake || jay.open) return;
  const w = new SR(); jay.wake = w; w.lang = "en-GB"; w.continuous = true; w.interimResults = true;
  w.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const rest = wakeMatch(e.results[i][0].transcript);
      if (rest !== null && e.results[i].isFinal) { stopWake(); if (rest.trim().length > 2) { openJay().then(() => askJay(rest, { voice: true })); } else openJay({ listen: true }); return; }
    }
  };
  w.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") jay.wakeBlocked = true; };
  w.onend = () => { if (jay.wake === w) { jay.wake = null; if (!jay.wakeBlocked) setTimeout(startWake, 400); } };
  $("#jayFab")?.classList.add("wake-on");
  try { w.start(); } catch { jay.wake = null; }
}
function stopWake() { const w = jay.wake; jay.wake = null; $("#jayFab")?.classList.remove("wake-on"); try { w?.abort(); } catch { /* fine */ } }
document.addEventListener("visibilitychange", () => { if (document.hidden) stopWake(); else startWake(); });
addEventListener("pointerdown", () => { if (cfg.wake && !jay.wake) { jay.wakeBlocked = false; startWake(); } }, { passive: true });

export async function initJay() { build(); await loadJaySettings(); jayPhase("idle"); setTimeout(startWake, 1500); }
export const isJayOpen = () => jay.open;
