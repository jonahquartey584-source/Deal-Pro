import { S, save, api, esc, toast, themeDots, THEMES, applyTheme, importData, rerender, today, VERSION } from "../app.js";

export const title = "Settings";

export function render(el) {
  el.innerHTML = `
  <div class="card"><h2>Theme</h2><div class="theme-dots" id="dots" style="margin:6px 0 4px"></div>
    <div class="small muted" id="tname">${esc(THEMES.find((t) => t.id === S.theme)?.name || "")}</div>
    <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" id="vid" ${S.settings.bgVideo !== false ? "checked" : ""}> Moving liquid background (turn off to save battery)</label></div>
  <div class="card"><h2>Your name</h2><input class="input" id="name" value="${esc(S.profile.name)}"></div>
  <div class="card"><h2>Reminders</h2>
    <p class="small muted" style="margin-top:0">A notification 5 minutes before planner items with a time, while the app is open. On iPhone, add the app to your Home Screen first.</p>
    <button class="btn" id="notify">${S.settings.notify ? "✓ Reminders on — turn off" : "Turn on reminders"}</button></div>
  <div class="card"><h2>Jay (assistant)</h2>
    <p class="small muted" style="margin-top:0" id="keyInfo">Checking…</p>
    <input class="input" id="key" type="password" placeholder="Paste Anthropic API key (sk-ant-…)" autocomplete="off">
    <input class="input" id="model" placeholder="Model" style="margin-top:8px">
    <button class="btn primary" id="saveKey" style="margin-top:8px">Save</button></div>
  <div class="card"><h2>Backup</h2>
    <p class="small muted" style="margin-top:0">Everything is saved on the home computer (with a daily backup). You can also download a copy.</p>
    <div class="row wrap"><button class="btn" id="export">Download backup</button><label class="btn">Restore from file<input type="file" id="import" accept="application/json" hidden></label></div></div>
  <p class="small muted center">Qp Homebase ${VERSION} · pink & green edition</p>`;

  themeDots(el.querySelector("#dots"), () => (el.querySelector("#tname").textContent = THEMES.find((t) => t.id === S.theme).name));
  el.querySelector("#vid").onchange = (e) => { S.settings.bgVideo = e.target.checked; save(); applyTheme(S.theme); };
  el.querySelector("#name").onchange = (e) => { S.profile.name = e.target.value.trim(); save(); toast("Saved"); };
  el.querySelector("#notify").onclick = async () => {
    if (S.settings.notify) { S.settings.notify = false; save(); return rerender(); }
    if (!("Notification" in window)) return toast("This browser can't show notifications — add the app to your Home Screen first");
    const p = await Notification.requestPermission();
    if (p === "granted") { S.settings.notify = true; save(); new Notification("Qp Homebase", { body: "Reminders are on 💕" }); rerender(); } else toast("Notifications were not allowed");
  };
  const info = el.querySelector("#keyInfo"), model = el.querySelector("#model");
  api("GET", "/api/settings").then((s) => { info.textContent = s.hasApiKey ? `Connected ${s.keyHint ? "(" + s.keyHint + ")" : ""}. Jay is ready.` : "Add an Anthropic API key to chat with Jay. Everything else works without one."; model.value = s.model; }).catch(() => (info.textContent = "Can't reach the home computer right now."));
  el.querySelector("#saveKey").onclick = async () => {
    try { const s = await api("PUT", "/api/settings", { apiKey: el.querySelector("#key").value || undefined, model: model.value }); el.querySelector("#key").value = ""; info.textContent = s.hasApiKey ? `Connected (${s.keyHint}). Jay is ready.` : "No key saved."; toast("Saved"); }
    catch (e) { toast(e.message); }
  };
  el.querySelector("#export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
    a.download = `qp-homebase-backup-${today()}.json`; a.click();
  };
  el.querySelector("#import").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!confirm("Replace everything in the app with this backup?")) return; importData(d); applyTheme(S.theme); toast("Backup restored"); rerender(); }
    catch { toast("That file isn't a Qp Homebase backup"); }
  };
}
