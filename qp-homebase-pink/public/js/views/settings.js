import { S, save, esc, toast, themeDots, THEMES, applyTheme, importData, rerender, today, VERSION, idbGet, idbSet, backupStatus } from "../app.js";

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
