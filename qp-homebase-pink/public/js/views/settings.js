import { S, save, esc, toast, themeDots, THEMES, applyTheme, importData, rerender, today, VERSION, idbGet, idbSet, backupStatus, icon } from "../app.js";
import { lockConfig, LOCKABLE, hasProtection, isUnlocked, faceIdAvailable, setupFaceId, unlockWithFaceId, unlockWithPin, setPin, setSections, removeProtection } from "../lock.js";

export const title = "Settings";

export function render(el) {
  el.innerHTML = `
  <div class="card"><h2>Theme</h2><div class="theme-dots" id="dots" style="margin:6px 0 4px"></div>
    <div class="small muted" id="tname">${esc(THEMES.find((t) => t.id === S.theme)?.name || "")}</div>
    <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" id="vid" ${S.settings.bgVideo !== false ? "checked" : ""}> Moving liquid background (turn off to save battery)</label></div>
  <div class="card" id="privacy"><h2 class="row" style="gap:8px">${icon("lock")} Privacy</h2><div id="privBody" class="small muted">Loading…</div></div>
  <div class="card"><h2>Your name</h2><input class="input" id="name" value="${esc(S.profile.name)}"></div>
  <div class="card"><h2>Reminders</h2>
    <p class="small muted" style="margin-top:0">A notification 5 minutes before planner items with a time, while the app is open. On iPhone, add the app to your Home Screen first.</p>
    <button class="btn" id="notify">${S.settings.notify ? "✓ Reminders on — turn off" : "Turn on reminders"}</button></div>
  <div class="card"><h2>Jay (assistant)</h2>
    <p class="small muted" style="margin-top:0" id="keyInfo">Checking…</p>
    <input class="input" id="key" type="password" placeholder="Paste Anthropic API key (sk-ant-…)" autocomplete="off">
    <input class="input" id="model" placeholder="Model" style="margin-top:8px">
    <div class="row" style="margin-top:8px"><button class="btn primary grow" id="saveKey">Save on this phone</button><button class="btn" id="delKey">Remove</button></div></div>
  <div class="card"><h2>Your data</h2>
    <p class="small muted" style="margin-top:0">Everything is saved on this phone, so the app works anywhere, even with no internet and the MacBook off. Whenever the MacBook is on, a backup copy is saved there automatically.</p>
    <div class="row" style="gap:10px;margin:6px 0 12px"><span id="bdot" style="width:10px;height:10px;border-radius:50%;flex:none"></span><span class="small" id="bstat"></span></div>
    <div class="row wrap"><button class="btn" id="export">Download backup</button><label class="btn">Restore from file<input type="file" id="import" accept="application/json" hidden></label></div></div>
  <p class="small muted center">Qp Homebase &quot;Ruby Edition&quot; · v${VERSION}</p>`;

  themeDots(el.querySelector("#dots"), () => (el.querySelector("#tname").textContent = THEMES.find((t) => t.id === S.theme).name));
  el.querySelector("#vid").onchange = (e) => { S.settings.bgVideo = e.target.checked; save(); applyTheme(S.theme); };
  el.querySelector("#name").onchange = (e) => { S.profile.name = e.target.value.trim(); save(); toast("Saved"); };
  el.querySelector("#notify").onclick = async () => {
    if (S.settings.notify) { S.settings.notify = false; save(); return rerender(); }
    if (!("Notification" in window)) return toast("This browser can't show notifications — add the app to your Home Screen first");
    const p = await Notification.requestPermission();
    if (p === "granted") { S.settings.notify = true; save(); new Notification("Qp Homebase Ruby Edition", { body: "Reminders are on 💕" }); rerender(); } else toast("Notifications were not allowed");
  };
  const info = el.querySelector("#keyInfo"), model = el.querySelector("#model");
  const showKey = (k) => { info.textContent = k?.apiKey ? `Saved on this phone (${k.apiKey.slice(0, 7)}…${k.apiKey.slice(-4)}). Jay is ready.` : "Add an Anthropic API key to chat with Jay. Everything else works without one."; model.value = k?.model || "claude-opus-5-5"; };
  idbGet("jay").then(showKey);
  el.querySelector("#saveKey").onclick = async () => {
    const cur = (await idbGet("jay")) || {}, k = el.querySelector("#key").value.trim();
    const next = { apiKey: k || cur.apiKey || "", model: model.value.trim() || "claude-opus-5-5" };
    await idbSet("jay", next); el.querySelector("#key").value = ""; showKey(next); toast("Saved on this phone");
  };
  el.querySelector("#delKey").onclick = async () => { await idbSet("jay", {}); showKey({}); toast("Key removed"); };
  renderPrivacy(el.querySelector("#privBody"));
  const b = backupStatus();
  const when = b.backedUpAt ? new Date(b.backedUpAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  el.querySelector("#bdot").style.background = b.macReachable ? "var(--good)" : "var(--muted)";
  el.querySelector("#bstat").textContent = b.macReachable ? (b.pending ? "MacBook connected · backing up…" : `Backed up to the MacBook · ${when}`) : (when ? `MacBook not reachable right now · last backup ${when}` : "MacBook not reachable right now · will back up when it's on");
  el.querySelector("#export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
    a.download = `qp-homebase-backup-${today()}.json`; a.click();
  };
  el.querySelector("#import").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!confirm("Replace everything in the app with this backup?")) return; importData(d); applyTheme(S.theme); toast("Backup restored"); rerender(); }
    catch { toast("That file isn't a Qp Homebase Ruby Edition backup"); }
  };
}

async function renderPrivacy(box) {
  const cfg = await lockConfig(), on = hasProtection(), canFace = await faceIdAvailable();
  if (on && !isUnlocked()) {
    box.innerHTML = `<p style="margin-top:0">Private sections are locked. Unlock to change these settings.</p>
      ${cfg.credId ? `<button class="btn primary" id="pvFace">Unlock with Face ID</button>` : ""}
      ${cfg.pinHash ? `<form id="pvPin" class="row" style="margin-top:8px"><input class="input grow" id="pvPinIn" type="password" inputmode="numeric" placeholder="Passcode"><button class="btn">Unlock</button></form>` : ""}
      <p class="small" id="pvErr" style="color:var(--bad)"></p>`;
    const again = () => renderPrivacy(box), fail = (e) => (box.querySelector("#pvErr").textContent = e?.name === "NotAllowedError" ? "Face ID was cancelled" : e.message);
    box.querySelector("#pvFace")?.addEventListener("click", () => unlockWithFaceId().then(again, fail));
    box.querySelector("#pvPin")?.addEventListener("submit", (e) => { e.preventDefault(); unlockWithPin(box.querySelector("#pvPinIn").value).then(again, fail); });
    return;
  }
  box.innerHTML = `
    <p style="margin-top:0">Choose what needs Face ID to open. It locks again whenever you leave the app.</p>
    <div class="row wrap" id="pvSecs">${Object.entries(LOCKABLE).map(([k, n]) => `<button class="chip ${cfg.sections.includes(k) ? "on" : ""}" data-sec="${k}">${n}</button>`).join("")}</div>
    <div class="row wrap" style="margin-top:14px;gap:8px">
      ${cfg.credId ? `<span class="chip on">Face ID is on</span>` : canFace ? `<button class="btn primary" id="pvSetFace">Turn on Face ID</button>` : `<span class="small">Face ID isn't available here. Open the app from its Home Screen icon on the iPhone.</span>`}
      <button class="btn" id="pvSetPin">${cfg.pinHash ? "Change passcode" : "Set a backup passcode"}</button>
      ${on ? `<button class="btn danger" id="pvOff">Turn off</button>` : ""}
    </div>
    <p class="small" style="margin-bottom:0">${on ? "" : "Nothing is locked until Face ID or a passcode is turned on."}</p>`;
  box.querySelector("#pvSecs").onclick = async (e) => {
    const b = e.target.closest("[data-sec]"); if (!b) return;
    const k = b.dataset.sec, list = cfg.sections.includes(k) ? cfg.sections.filter((x) => x !== k) : [...cfg.sections, k];
    await setSections(list); renderPrivacy(box);
  };
  box.querySelector("#pvSetFace")?.addEventListener("click", () => setupFaceId().then(() => { toast("Face ID is on"); renderPrivacy(box); }, (e) => toast(e?.name === "NotAllowedError" ? "Face ID setup was cancelled" : "Couldn't turn on Face ID: " + e.message)));
  box.querySelector("#pvSetPin").onclick = async () => {
    const a = prompt("Choose a passcode (at least 4 digits)"); if (!a) return;
    if (!/^\d{4,}$/.test(a)) return toast("Use at least 4 digits");
    const b2 = prompt("Type it again"); if (a !== b2) return toast("Those didn't match");
    await setPin(a); toast("Passcode saved"); renderPrivacy(box);
  };
  box.querySelector("#pvOff")?.addEventListener("click", async () => { if (!confirm("Turn off Face ID and the passcode? Private sections will open without unlocking.")) return; await removeProtection(); toast("Privacy lock turned off"); renderPrivacy(box); });
}
