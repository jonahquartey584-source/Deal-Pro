import { S, save, today, addDays, fmtDate, esc, uid, rerender, setParams, openSheet, closeSheet, toast, dur, pad, mondayOf } from "../app.js";
import { timerSeconds, readingOn, readingBetween, weekRange, monthRange, readingStreak } from "./shared.js";

export const title = "Bible";
const B = () => S.bible;
const clock = (s) => { s = Math.floor(s); return `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };

export function render(el, p) {
  const tab = p.tab || "read";
  const seg = `<div class="seg" style="margin-top:4px">${[["read", "Reading time"], ["notes", "Notes"]].map(([k, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>`;
  el.innerHTML = seg + (tab === "read" ? readView(p) : notesView(p));
  let iv = null;
  if (tab === "read") {
    const face = el.querySelector("#face");
    iv = setInterval(() => { if (face) face.textContent = clock(timerSeconds()); }, 1000);
  }
  el.querySelector("#search")?.addEventListener("input", (e) => { clearTimeout(window.__bq); window.__bq = setTimeout(() => { setParams({ q: e.target.value }); const i = document.querySelector("#search"); i?.focus(); i?.setSelectionRange(99, 99); }, 300); });
  el.onclick = (e) => onClick(e, p);
  return () => clearInterval(iv);
}

// ---------- reading timer & logs ----------
function readView(p) {
  const t = B().timer, run = t?.running, paused = t && !t.running;
  const [ws, we] = weekRange(), [ms, me] = monthRange();
  const goal = (+B().goalMinutes || 15) * 60, todayS = readingOn(today());
  const range = p.range || "daily";
  let bars = [];
  if (range === "daily") bars = Array.from({ length: 7 }, (_, i) => { const d = addDays(today(), i - 6); return { l: fmtDate(d, { weekday: "short" }).slice(0, 2), s: readingOn(d) }; });
  if (range === "weekly") bars = Array.from({ length: 8 }, (_, i) => { const m = addDays(mondayOf(today()), (i - 7) * 7); return { l: `${+m.slice(8)}/${+m.slice(5, 7)}`, s: readingBetween(m, addDays(m, 6)) }; });
  if (range === "monthly") bars = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); const [a, b] = monthRange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`); return { l: d.toLocaleDateString("en-GB", { month: "short" }), s: readingBetween(a, b) }; });
  const max = Math.max(60, ...bars.map((b) => b.s));
  const recent = [...B().sessions].sort((a, b) => (b.date + (b.start || "")).localeCompare(a.date + (a.start || ""))).slice(0, 15);
  return `
  <div class="card center">
    <div class="small muted">${run ? "Reading…" : paused ? "Paused" : "Start the timer when you open your Bible"}</div>
    <div class="timer-face" id="face">${clock(timerSeconds())}</div>
    <input class="input center" id="ref" placeholder="What are you reading? e.g. Psalm 23" value="${esc(t?.ref || "")}">
    <div class="row" style="justify-content:center;margin-top:12px;gap:8px">
      ${!t ? `<button class="btn primary wide" data-act="start" style="max-width:260px">▶ Start reading</button>` : `
        ${run ? `<button class="btn" data-act="pause">❚❚ Pause</button>` : `<button class="btn" data-act="resume">▶ Resume</button>`}
        <button class="btn primary" data-act="finish">✓ Finish & save</button>
        <button class="btn danger" data-act="discard">✕</button>`}
    </div>
  </div>
  <div class="grid3">
    <div class="stat"><div class="k">Today</div><div class="v">${dur(todayS)}</div><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (todayS / goal) * 100)}%"></i></div></div>
    <div class="stat"><div class="k">This week</div><div class="v">${dur(readingBetween(ws, we))}</div></div>
    <div class="stat"><div class="k">This month</div><div class="v">${dur(readingBetween(ms, me))}</div></div>
  </div>
  <div class="row spread small muted" style="margin-top:8px"><span>🔥 ${readingStreak()}-day streak</span><button class="btn small ghost" data-act="goal">Daily goal: ${B().goalMinutes || 15} min ✎</button></div>
  <div class="card"><div class="row spread"><h2>Log</h2></div>
    <div class="seg">${[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([k, n]) => `<button class="${range === k ? "on" : ""}" data-range="${k}">${n}</button>`).join("")}</div>
    <div class="bars">${bars.map((b) => `<div><span class="small">${b.s >= 60 ? Math.round(b.s / 60) : ""}</span><i style="height:${(b.s / max) * 100}%"></i>${b.l}</div>`).join("")}</div>
    <div class="small muted center">minutes · total ${dur(bars.reduce((a, b) => a + b.s, 0))}</div>
  </div>
  <div class="card"><div class="row spread"><h2>Sessions</h2><button class="btn small" data-act="manual">+ Add time</button></div>
    ${recent.length ? `<ul class="list">${recent.map((s) => `<li class="item"><span class="t"><b>${dur(s.seconds)}</b> ${s.ref ? `· ${esc(s.ref)}` : ""}<div class="small muted">${fmtDate(s.date)}${s.start ? ` · ${s.start}` : ""}</div></span><button class="x" data-delsession="${s.id}">✕</button></li>`).join("")}</ul>` : `<div class="empty">Your reading sessions will show here.</div>`}
  </div>`;
}

// ---------- notes with nested folders ----------
const folderPath = (id) => { const out = []; let f = B().folders.find((x) => x.id === id); while (f) { out.unshift(f); f = B().folders.find((x) => x.id === f.parentId); } return out; };
const allFolderOptions = (sel, exclude) => {
  const rows = [`<option value="">📖 All notes (top level)</option>`];
  const walk = (parent, depth) => B().folders.filter((f) => (f.parentId || "") === parent && f.id !== exclude).sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => { rows.push(`<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${"  ".repeat(depth)}${"— ".repeat(depth ? 1 : 0)}📁 ${esc(f.name)}</option>`); walk(f.id, depth + 1); });
  walk("", 1); return rows.join("");
};
const countIn = (id) => { const kids = B().folders.filter((f) => f.parentId === id).map((f) => f.id); return B().notes.filter((n) => n.folderId === id).length + kids.reduce((a, k) => a + countIn(k), 0); };

function notesView(p) {
  const fid = p.folder || "", q = (p.q || "").toLowerCase();
  if (q) {
    const hits = B().notes.filter((n) => [n.title, n.ref, n.body].join(" ").toLowerCase().includes(q));
    return `<div class="row" style="margin-top:12px"><input class="input grow" id="search" placeholder="Search notes" value="${esc(p.q)}"></div>
      <div class="card">${hits.length ? `<ul class="list">${hits.map(noteRow).join("")}</ul>` : `<div class="empty">No notes match.</div>`}</div>`;
  }
  const path = folderPath(fid);
  const subs = B().folders.filter((f) => (f.parentId || "") === fid).sort((a, b) => a.name.localeCompare(b.name));
  const notes = B().notes.filter((n) => (n.folderId || "") === fid).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return `
  <div class="row" style="margin-top:12px"><input class="input grow" id="search" placeholder="Search notes"></div>
  <div class="row wrap small" style="margin:12px 0 0;gap:4px"><button class="chip ${!fid ? "on" : ""}" data-folder="">📖 Notes</button>${path.map((f) => `› <button class="chip ${f.id === fid ? "on" : ""}" data-folder="${f.id}">${esc(f.name)}</button>`).join("")}</div>
  <div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="newNote">+ New note</button><button class="btn grow" data-act="newFolder">+ Folder${fid ? " inside" : ""}</button>${fid ? `<button class="btn" data-act="folderMenu">⋯</button>` : ""}</div>
  <div class="card">
    ${subs.length ? `<div class="tree">${subs.map((f) => `<button class="folder btn ghost" data-folder="${f.id}" style="width:100%;border:0;border-bottom:1px solid var(--line);border-radius:0;text-align:left">📁 <span class="grow">${esc(f.name)}</span><span class="small muted">${countIn(f.id)} ›</span></button>`).join("")}</div>` : ""}
    ${notes.length ? `<ul class="list">${notes.map(noteRow).join("")}</ul>` : !subs.length ? `<div class="empty">${fid ? "This folder is empty." : "Write notes from your reading. Make folders (and folders inside folders) to keep them tidy — e.g. Sermons › 2026 › December."}</div>` : ""}
  </div>`;
}
const noteRow = (n) => `<li class="item"><button class="btn ghost" data-note="${n.id}" style="flex:1;border:0;padding:0;text-align:left"><span class="t"><b>${esc(n.title || "Untitled")}</b>${n.ref ? ` <span class="pill">${esc(n.ref)}</span>` : ""}<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((n.body || "").slice(0, 90))}</div><div class="small muted">${n.updated ? fmtDate(n.updated.slice(0, 10)) : ""}</div></span></button></li>`;

function noteSheet(n, folderId) {
  const isNew = !n; n ||= { title: "", ref: "", body: "", folderId };
  openSheet(`<h2>${isNew ? "New note" : "Note"}</h2>
    <input class="input" id="t" placeholder="Title" value="${esc(n.title)}" ${isNew ? "autofocus" : ""} style="font-weight:700;font-size:1.1rem">
    <input class="input" id="r" placeholder="Scripture (e.g. John 3:16)" value="${esc(n.ref)}" style="margin-top:8px">
    <textarea class="input" id="b" placeholder="Write your thoughts, prayers, what God is showing you…" style="min-height:42dvh;margin-top:8px">${esc(n.body)}</textarea>
    <label class="field">Folder</label><select class="input" id="f">${allFolderOptions(n.folderId || "")}</select>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Close</button></div>`, (c) => {
    c.querySelector("#ok").onclick = () => {
      const v = (id) => c.querySelector(id).value;
      if (!v("#t").trim() && !v("#b").trim()) return toast("Write something first");
      Object.assign(n, { title: v("#t").trim(), ref: v("#r").trim(), body: v("#b"), folderId: v("#f"), updated: new Date().toISOString() });
      if (isNew) B().notes.push({ id: uid(), created: new Date().toISOString(), ...n });
      save(); closeSheet(); toast("Note saved"); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { if (!confirm("Delete this note?")) return; B().notes = B().notes.filter((x) => x !== n); save(); closeSheet(); rerender(); });
  });
}

function folderMenu(fid) {
  const f = B().folders.find((x) => x.id === fid); if (!f) return;
  openSheet(`<h2>📁 ${esc(f.name)}</h2>
    <label class="field">Name</label><input class="input" id="n" value="${esc(f.name)}">
    <label class="field">Inside</label><select class="input" id="parent">${allFolderOptions(f.parentId || "", f.id).replace(/<option value="([^"]*)"/g, (m, id) => isDescendant(id, f.id) ? `<option disabled value="${id}"` : m)}</select>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button><button class="btn danger" id="del">Delete folder</button><button class="btn" data-close>Cancel</button></div>
    <p class="small muted">Deleting a folder moves its notes and folders up one level — nothing is lost.</p>`, (c) => {
    c.querySelector("#ok").onclick = () => { f.name = c.querySelector("#n").value.trim() || f.name; f.parentId = c.querySelector("#parent").value; save(); closeSheet(); rerender(); };
    c.querySelector("#del").onclick = () => {
      if (!confirm(`Delete folder “${f.name}”? Its contents move up a level.`)) return;
      B().notes.forEach((n) => { if (n.folderId === f.id) n.folderId = f.parentId || ""; });
      B().folders.forEach((x) => { if (x.parentId === f.id) x.parentId = f.parentId || ""; });
      B().folders = B().folders.filter((x) => x !== f); save(); closeSheet(); setParams({ folder: f.parentId || "" });
    };
  });
}
function isDescendant(id, ancestor) { let f = B().folders.find((x) => x.id === id); while (f) { if (f.parentId === ancestor) return true; f = B().folders.find((x) => x.id === f.parentId); } return false; }

// ---------- clicks ----------
function onClick(e, p) {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset, b_ = B();
  if (d.tab) return setParams({ tab: d.tab, q: "" });
  if (d.range) return setParams({ range: d.range });
  if (d.folder !== undefined) return setParams({ folder: d.folder, q: "" });
  if (d.note) return noteSheet(b_.notes.find((n) => n.id === d.note));
  if (d.delsession && confirm("Delete this session?")) { b_.sessions = b_.sessions.filter((s) => s.id !== d.delsession); save(); return rerender(); }
  const ref = document.querySelector("#ref")?.value.trim() || "";
  switch (d.act) {
    case "start": b_.timer = { running: true, startedAt: Date.now(), accumulated: 0, ref, date: today(), start: new Date().toTimeString().slice(0, 5) }; break;
    case "pause": b_.timer.accumulated = timerSeconds(); b_.timer.running = false; b_.timer.ref = ref; break;
    case "resume": b_.timer.running = true; b_.timer.startedAt = Date.now(); b_.timer.ref = ref; break;
    case "finish": {
      const s = Math.round(timerSeconds());
      if (s >= 5) b_.sessions.push({ id: uid(), date: b_.timer.date || today(), start: b_.timer.start, seconds: s, ref });
      b_.timer = null; toast(s >= 5 ? `Saved ${dur(s)} of reading 🙏` : "Too short to save"); break;
    }
    case "discard": if (!confirm("Discard this timer without saving?")) return; b_.timer = null; break;
    case "goal": { const v = prompt("Daily reading goal (minutes)", b_.goalMinutes || 15); if (!v || !(+v > 0)) return; b_.goalMinutes = +v; break; }
    case "manual": { const v = prompt("Minutes read (added to today)", ""); if (!v || !(+v > 0)) return; b_.sessions.push({ id: uid(), date: today(), seconds: Math.round(+v * 60), ref: "Added manually" }); break; }
    case "newNote": return noteSheet(null, p.folder || "");
    case "newFolder": { const n = prompt("Folder name"); if (!n?.trim()) return; b_.folders.push({ id: uid(), name: n.trim(), parentId: p.folder || "" }); break; }
    case "folderMenu": return folderMenu(p.folder);
    default: return;
  }
  save(); rerender();
}
