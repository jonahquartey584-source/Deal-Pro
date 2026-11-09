// Day Planner front end (no build step).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayStr = () => toDateStr(new Date());
const addDays = (s, n) => { const d = fromDateStr(s); d.setDate(d.getDate() + n); return toDateStr(d); };
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${pad(m)}${ampm}` : `${h12}${ampm}`;
}
const fmtRange = (s, e) => (s ? fmtTime(s) + (e ? `–${fmtTime(e)}` : "") : "");

const storage = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

const state = {
  date: todayStr(),
  tasks: [],
  schedule: [],
  settings: {},
  chat: storage.get("planner.chat", { messages: [], log: [] }),
  busy: false,
};

// ---------------- day view ----------------

async function loadDay() {
  const { tasks } = await api("GET", `/api/day?date=${state.date}`);
  state.tasks = tasks;
  renderDay();
  loadWeek();
  checkCarryOver();
}

function renderDay() {
  const d = fromDateStr(state.date);
  const t = todayStr();
  const diff = Math.round((d - fromDateStr(t)) / 86400000);
  $("#dayEyebrow").textContent = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : DAY_LONG[d.getDay()];
  $("#dayTitle").textContent = `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  $("#datePicker").value = state.date;

  const done = state.tasks.filter((x) => x.done).length;
  const total = state.tasks.length;
  $("#progressFill").style.width = total ? `${(done / total) * 100}%` : "0";
  $("#progressText").textContent = total ? `${done} of ${total} done` : "No tasks yet";

  const isToday = state.date === t;
  const now = nowTime();
  const current = isToday ? state.tasks.find((x) => !x.done && x.start && x.start <= now && (x.end ? x.end > now : false)) : null;
  const next = isToday ? state.tasks.find((x) => !x.done && x.start && x.start > now) : null;

  const list = $("#taskList");
  list.innerHTML = state.tasks.map((task) => {
    const cls = ["task", task.done && "done", current?.id === task.id && "now", isToday && task.start && (task.end || task.start) < now && "past"].filter(Boolean).join(" ");
    return `<li class="${cls}" data-id="${task.id}">
      <input type="checkbox" class="check" ${task.done ? "checked" : ""} aria-label="Mark ${esc(task.title)} done">
      <span class="time">${esc(fmtRange(task.start, task.end)) || '<span class="muted">Anytime</span>'}</span>
      <div class="body">
        <div class="title">${esc(task.title)}</div>
        ${task.notes ? `<div class="notes">${esc(task.notes)}</div>` : ""}
      </div>
      <div class="meta">
        ${task.priority === "high" ? '<span class="tag high">High</span>' : task.priority === "low" ? '<span class="tag">Low</span>' : ""}
        ${task.scheduleId ? '<span class="tag" title="From your schedule">Schedule</span>' : ""}
        <button class="icon-btn edit" aria-label="Edit">✎</button>
      </div>
    </li>`;
  }).join("");
  $("#emptyState").hidden = total > 0;

  const nowCard = $("#nowCard");
  if (current || next) {
    nowCard.hidden = false;
    nowCard.innerHTML = current
      ? `<div><div class="label">Now</div><strong>${esc(current.title)}</strong><span class="muted">${fmtRange(current.start, current.end)}</span></div>${next ? `<div style="margin-left:auto;text-align:right"><div class="label">Next</div><strong>${esc(next.title)}</strong><span class="muted">${fmtTime(next.start)}</span></div>` : ""}`
      : `<div><div class="label">Up next</div><strong>${esc(next.title)}</strong><span class="muted">${fmtRange(next.start, next.end)} · in ${untilText(next.start)}</span></div>`;
  } else {
    nowCard.hidden = true;
  }
}

function untilText(start) {
  const [h, m] = start.split(":").map(Number);
  const target = new Date(); target.setHours(h, m, 0, 0);
  const mins = Math.max(0, Math.round((target - new Date()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + "m" : ""}`.trim();
}

async function loadWeek() {
  const d = fromDateStr(state.date);
  const monday = addDays(state.date, -((d.getDay() + 6) % 7));
  let summary = {};
  try { summary = await api("GET", `/api/summary?from=${monday}&days=7`); } catch { /* strip still renders */ }
  const t = todayStr();
  $("#weekStrip").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const ds = addDays(monday, i);
    const dd = fromDateStr(ds);
    const s = summary[ds] || { total: 0, done: 0 };
    const pct = s.total ? (s.done / s.total) * 100 : 0;
    return `<button class="wday ${ds === t ? "today" : ""} ${ds === state.date ? "selected" : ""}" data-date="${ds}" title="${s.done}/${s.total} done">
      <small>${DAY_NAMES[dd.getDay()]}</small><b>${dd.getDate()}</b><span class="dots"><i style="width:${pct}%"></i></span>
    </button>`;
  }).join("");
}

async function checkCarryOver() {
  const banner = $("#carryBanner");
  banner.hidden = true;
  if (state.date !== todayStr()) return;
  const yesterday = addDays(state.date, -1);
  try {
    const { tasks } = await api("GET", `/api/day?date=${yesterday}`);
    const open = tasks.filter((x) => !x.done && !x.scheduleId);
    if (open.length) {
      $("#carryText").textContent = `${open.length} unfinished task${open.length > 1 ? "s" : ""} from yesterday.`;
      banner.hidden = false;
    }
  } catch { /* ignore */ }
}

function setDate(ds) {
  state.date = ds;
  loadDay().catch((e) => toast(e.message));
}

// Pulls a time out of quick-add text: "Call bank at 2pm" -> start 14:00.
function splitTitleTime(text) {
  const m = text.match(/^(.*?)(?:\s+(?:at|@))?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})$/i);
  if (!m || !m[1].trim()) return { title: text, start: "" };
  const [, hh, mins, ampm] = m[2].toLowerCase().replace(/\s/g, "").match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  let h = Number(hh);
  const min = Number(mins || 0);
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return { title: text, start: "" };
  return { title: m[1].trim(), start: `${pad(h)}:${pad(min)}` };
}

$("#addTaskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("#newTitle").value.trim();
  if (!raw) return;
  let { title, start } = splitTitleTime(raw);
  if ($("#newStart").value) start = $("#newStart").value;
  try {
    await api("POST", "/api/tasks", { date: state.date, title, start, priority: $("#newPriority").value });
    $("#newTitle").value = "";
    $("#newStart").value = "";
    $("#newPriority").value = "normal";
    await loadDay();
  } catch (err) { toast(err.message); }
});

$("#taskList").addEventListener("click", async (e) => {
  const li = e.target.closest(".task");
  if (!li) return;
  const task = state.tasks.find((x) => x.id === li.dataset.id);
  if (e.target.classList.contains("check")) {
    try {
      await api("PATCH", `/api/tasks/${task.id}`, { done: e.target.checked });
      task.done = e.target.checked;
      renderDay();
      loadWeek();
    } catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
  } else if (e.target.closest(".edit") || e.target.classList.contains("title")) {
    openTaskDialog(task);
  }
});

$("#prevDay").onclick = () => setDate(addDays(state.date, -1));
$("#nextDay").onclick = () => setDate(addDays(state.date, 1));
$("#goToday").onclick = () => setDate(todayStr());
$("#datePicker").onchange = (e) => e.target.value && setDate(e.target.value);
$("#weekStrip").addEventListener("click", (e) => { const b = e.target.closest(".wday"); if (b) setDate(b.dataset.date); });
$("#carryBtn").onclick = async () => {
  try {
    const { moved } = await api("POST", "/api/carry-over", { from: addDays(state.date, -1), to: state.date });
    toast(`Moved ${moved} task${moved === 1 ? "" : "s"} to today`);
    loadDay();
  } catch (err) { toast(err.message); }
};

// task dialog
let editingTask = null;
function openTaskDialog(task) {
  editingTask = task;
  const f = $("#taskForm");
  f.title.value = task.title;
  f.start.value = task.start || "";
  f.end.value = task.end || "";
  f.date.value = task.date;
  f.priority.value = task.priority || "normal";
  f.notes.value = task.notes || "";
  $("#taskFromSchedule").hidden = !task.scheduleId;
  $("#taskDialog").showModal();
}
$("#taskForm").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  const f = e.target;
  try {
    await api("PATCH", `/api/tasks/${editingTask.id}`, {
      title: f.title.value, start: f.start.value, end: f.end.value, date: f.date.value, priority: f.priority.value, notes: f.notes.value,
    });
    loadDay();
  } catch (err) { toast(err.message); }
});
$("#deleteTask").onclick = async () => {
  try {
    await api("DELETE", `/api/tasks/${editingTask.id}`);
    $("#taskDialog").close();
    toast("Task deleted");
    loadDay();
  } catch (err) { toast(err.message); }
};

// ---------------- schedule view ----------------

async function loadSchedule() {
  const { items } = await api("GET", "/api/schedule");
  state.schedule = items;
  renderSchedule();
}

function renderSchedule() {
  const byTime = (a, b) => (a.start || "99").localeCompare(b.start || "99") || a.title.localeCompare(b.title);
  const recurring = state.schedule.filter((s) => !s.date).sort(byTime);
  const order = [1, 2, 3, 4, 5, 6, 0];
  $("#weekGrid").innerHTML = order.map((d) => {
    const items = recurring.filter((s) => s.days.includes(d));
    return `<div class="week-col"><h4>${DAY_NAMES[d]}</h4>${items.map((s) =>
      `<button class="sched-chip ${s.priority === "high" ? "high" : ""}" data-id="${s.id}"><small>${fmtRange(s.start, s.end) || "Anytime"}</small>${esc(s.title)}</button>`,
    ).join("") || '<div class="muted small" style="text-align:center">—</div>'}</div>`;
  }).join("");

  const t = todayStr();
  const oneOff = state.schedule.filter((s) => s.date && s.date >= t).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  $("#oneOffCount").textContent = oneOff.length ? `(${oneOff.length} upcoming)` : "";
  $("#oneOffList").innerHTML = oneOff.map((s) => {
    const d = fromDateStr(s.date);
    return `<li data-id="${s.id}"><span class="when">${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${fmtRange(s.start, s.end) || "Anytime"}</span><span>${esc(s.title)}</span></li>`;
  }).join("") || '<li class="muted" style="cursor:default">No upcoming one-off items.</li>';
}

$("#weekGrid").addEventListener("click", (e) => { const b = e.target.closest(".sched-chip"); if (b) openItemDialog(state.schedule.find((s) => s.id === b.dataset.id)); });
$("#oneOffList").addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) openItemDialog(state.schedule.find((s) => s.id === li.dataset.id)); });
$("#addScheduleBtn").onclick = () => openItemDialog(null);
$("#clearSchedule").onclick = async () => {
  if (!confirm("Remove every item from your schedule? Tasks you've already finished stay in your history.")) return;
  await api("DELETE", "/api/schedule");
  toast("Schedule cleared");
  loadSchedule();
};

// schedule item dialog
let editingItem = null;
let itemDays = new Set();
function renderDayToggles() {
  $("#dayToggles").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" data-d="${d}" class="${itemDays.has(d) ? "on" : ""}">${DAY_NAMES[d]}</button>`).join("");
}
$("#dayToggles").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = Number(b.dataset.d);
  itemDays.has(d) ? itemDays.delete(d) : itemDays.add(d);
  $("#itemForm").kind.value = "repeat";
  renderDayToggles();
});
function openItemDialog(item) {
  editingItem = item;
  const f = $("#itemForm");
  f.title.value = item?.title || "";
  f.start.value = item?.start || "";
  f.end.value = item?.end || "";
  f.priority.value = item?.priority || "normal";
  f.notes.value = item?.notes || "";
  f.until.value = item?.until || "";
  f.date.value = item?.date || state.date;
  f.kind.value = item?.date ? "once" : "repeat";
  itemDays = new Set(item ? item.days : [1, 2, 3, 4, 5]);
  renderDayToggles();
  $("#itemDialogTitle").textContent = item ? "Edit schedule item" : "New schedule item";
  $("#deleteItem").hidden = !item;
  $("#itemDialog").showModal();
}
$("#itemForm").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  const f = e.target;
  const once = f.kind.value === "once";
  if (!once && itemDays.size === 0) { e.preventDefault(); toast("Pick at least one day"); return; }
  const body = {
    title: f.title.value, start: f.start.value, end: f.end.value, priority: f.priority.value, notes: f.notes.value,
    until: once ? "" : f.until.value,
    ...(once ? { date: f.date.value, days: [] } : { date: "", days: [...itemDays] }),
  };
  try {
    if (editingItem) await api("PATCH", `/api/schedule/${editingItem.id}`, body);
    else await api("POST", "/api/schedule", body);
    toast("Schedule saved");
    refreshAll();
  } catch (err) { toast(err.message); }
});
$("#deleteItem").onclick = async () => {
  if (!confirm(`Remove “${editingItem.title}” from your schedule?`)) return;
  await api("DELETE", `/api/schedule/${editingItem.id}`);
  $("#itemDialog").close();
  toast("Removed from schedule");
  refreshAll();
};

// ---------------- import ----------------

let importFilename = "";
let importItems = [];

function openImport() {
  $("#importStep1").hidden = false;
  $("#importStep2").hidden = true;
  $("#importText").value = "";
  $("#importFile").value = "";
  importFilename = "";
  $("#importAi").disabled = !state.settings.hasApiKey;
  $("#importAi").parentElement.title = state.settings.hasApiKey ? "" : "Add an API key in Settings to use this";
  $("#importDialog").showModal();
}

async function readFile(file) {
  importFilename = file.name;
  $("#importText").value = await file.text();
  toast(`Loaded ${file.name}`);
}
$("#importFile").onchange = (e) => e.target.files[0] && readFile(e.target.files[0]);
const drop = $("#dropZone");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
$("#showFormats").onclick = (e) => { e.preventDefault(); $("#formatsHelp").hidden = !$("#formatsHelp").hidden; };

function describeWhen(item) {
  const time = fmtRange(item.start, item.end) || "Anytime";
  if (item.date) {
    const d = fromDateStr(item.date);
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${time}`;
  }
  const days = item.days || [];
  const label = days.length === 7 || days.length === 0 ? "Daily" : days.join() === "1,2,3,4,5" ? "Weekdays" : days.map((d) => DAY_NAMES[d]).join(" ");
  return `${label} · ${time}`;
}

function normalizePreviewDays(item) {
  // The server normalises on save; this is just for the preview label.
  if (Array.isArray(item.days)) return item;
  if (typeof item.days === "string") {
    const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const s = item.days.toLowerCase();
    let days = [];
    if (/daily|every ?day/.test(s)) days = [0, 1, 2, 3, 4, 5, 6];
    else if (/weekday|mon\w*\s*-\s*fri/.test(s)) days = [1, 2, 3, 4, 5];
    else if (/weekend/.test(s)) days = [0, 6];
    else days = Object.entries(map).filter(([k]) => s.includes(k)).map(([, v]) => v);
    return { ...item, days };
  }
  return item;
}

$("#previewImport").onclick = async () => {
  const content = $("#importText").value;
  if (!content.trim()) { toast("Choose a file or paste your schedule first"); return; }
  const btn = $("#previewImport");
  const useAi = $("#importAi").checked;
  btn.disabled = true;
  btn.textContent = useAi ? "Claude is reading…" : "Reading…";
  try {
    const result = await api("POST", "/api/import", { filename: importFilename, content, useAi });
    importItems = result.items.map(normalizePreviewDays);
    const sk = result.skipped || {};
    const notes = [
      sk.past && `${sk.past} past event${sk.past > 1 ? "s" : ""} skipped`,
      sk.cancelled && `${sk.cancelled} cancelled skipped`,
      sk.unsupported && `${sk.unsupported} monthly/yearly repeat${sk.unsupported > 1 ? "s" : ""} added as one-offs`,
      sk.unparsed && `${sk.unparsed} line${sk.unparsed > 1 ? "s" : ""} not understood${state.settings.hasApiKey ? " (try “Read it with Claude”)" : ""}`,
    ].filter(Boolean);
    $("#importSummary").innerHTML = importItems.length
      ? `Found <strong>${importItems.length}</strong> item${importItems.length > 1 ? "s" : ""}. Untick any you don't want.${notes.length ? `<br><span class="muted small">${esc(notes.join(" · "))}</span>` : ""}`
      : `Nothing found to import.${notes.length ? ` <span class="muted small">${esc(notes.join(" · "))}</span>` : ""}`;
    $("#importPreview").innerHTML = importItems.map((it, i) =>
      `<li><input type="checkbox" data-i="${i}" checked><span class="when">${esc(describeWhen(it))}</span><span class="title">${esc(it.title)}</span></li>`,
    ).join("");
    $("#commitImport").disabled = importItems.length === 0;
    $("#importReplace").checked = false;
    $("#importStep1").hidden = true;
    $("#importStep2").hidden = false;
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Preview";
  }
};
$("#importBack").onclick = () => { $("#importStep1").hidden = false; $("#importStep2").hidden = true; };
$("#commitImport").onclick = async () => {
  const chosen = $$("#importPreview input:checked").map((c) => importItems[Number(c.dataset.i)]);
  if (!chosen.length) { toast("Nothing selected"); return; }
  const replace = $("#importReplace").checked;
  if (replace && state.schedule.length && !confirm("Replace your whole current schedule with these items?")) return;
  try {
    const { added } = await api("POST", "/api/import", { commit: true, items: chosen, replace, filename: importFilename || "pasted" });
    $("#importDialog").close();
    toast(`Imported ${added} item${added === 1 ? "" : "s"}. They're now on your days.`);
    refreshAll();
  } catch (err) { toast(err.message); }
};

// ---------------- settings ----------------

async function loadSettings() {
  state.settings = await api("GET", "/api/settings");
  $("#chatNoKey").hidden = state.settings.hasApiKey;
  $("#chatForm").hidden = !state.settings.hasApiKey;
  $("#chips").hidden = !state.settings.hasApiKey;
}

function openSettings() {
  const f = $("#settingsForm");
  const s = state.settings;
  f.name.value = s.name || "";
  f.apiKey.value = "";
  f.apiKey.placeholder = s.keySource === "settings" ? `Saved (${s.keyHint}). Paste a new one to replace it.` : "sk-ant-…";
  f.model.value = s.model || "";
  $("#keyStatus").textContent = s.keySource === "environment" ? "Using the ANTHROPIC_API_KEY from your environment." : s.keySource ? "" : "No key yet: the assistant is off until you add one.";
  $("#dataDir").textContent = `Your data is saved in ${s.dataDir}`;
  $("#notifyToggle").checked = storage.get("planner.notify", false) && "Notification" in window && Notification.permission === "granted";
  $("#settingsDialog").showModal();
}

$("#settingsForm").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  const f = e.target;
  const body = { name: f.name.value, model: f.model.value };
  if (f.apiKey.value.trim()) body.apiKey = f.apiKey.value.trim();
  try {
    await api("POST", "/api/settings", body);
    await loadSettings();
    toast("Settings saved");
  } catch (err) { toast(err.message); }
});

$("#notifyToggle").onchange = async (e) => {
  if (e.target.checked) {
    if (!("Notification" in window)) { toast("This browser doesn't support notifications"); e.target.checked = false; return; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Notifications are blocked for this page"); e.target.checked = false; return; }
  }
  storage.set("planner.notify", e.target.checked);
};

// ---------------- chat ----------------

function md(text) {
  // Small, safe markdown: paragraphs, bullet/numbered lists, **bold**, *italic*, `code`.
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = [];
  let list = null;
  for (const line of text.split("\n")) {
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      if (list !== tag) { if (list) out.push(`</${list}>`); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else {
      if (list) { out.push(`</${list}>`); list = null; }
      const h = line.match(/^#{1,4}\s+(.*)/);
      if (h) out.push(`<p><strong>${inline(h[1])}</strong></p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (list) out.push(`</${list}>`);
  return out.join("");
}

function renderChat() {
  const log = $("#chatLog");
  const intro = '<div class="msg assistant intro">Hi! I can see your tasks and schedule. Ask me to plan your day, add things, move tasks around or mark them done.</div>';
  log.innerHTML = intro + state.chat.log.map((m) =>
    m.role === "user" ? `<div class="msg user">${esc(m.text)}</div>` : `<div class="msg assistant ${m.error ? "error" : ""}">${md(m.text)}</div>`,
  ).join("") + (state.busy ? '<div class="msg assistant thinking">Thinking</div>' : "");
  log.scrollTop = log.scrollHeight;
}

async function sendChat(text) {
  text = text.trim();
  if (!text || state.busy) return;
  state.busy = true;
  $("#chatSend").disabled = true;
  state.chat.log.push({ role: "user", text });
  const outgoing = [...state.chat.messages, { role: "user", content: text }];
  renderChat();
  try {
    const result = await api("POST", "/api/chat", { messages: outgoing, date: state.date });
    state.chat.messages = result.messages;
    state.chat.log.push({ role: "assistant", text: result.reply + (result.truncated ? "\n\n*(reply cut short)*" : "") });
    if (result.changed) refreshAll();
  } catch (err) {
    state.chat.log.push({ role: "assistant", text: err.message, error: true });
  } finally {
    state.busy = false;
    $("#chatSend").disabled = false;
    storage.set("planner.chat", state.chat);
    renderChat();
  }
}

$("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chatInput");
  const text = input.value;
  input.value = "";
  sendChat(text);
});
$("#chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); }
});
$("#chips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) sendChat(c.textContent); });
$("#clearChat").onclick = () => {
  state.chat = { messages: [], log: [] };
  storage.set("planner.chat", state.chat);
  renderChat();
};

// ---------------- notifications & clock ----------------

const notified = new Set(storage.get("planner.notified", []));
function tick() {
  if (state.date === todayStr() && $("#view-day").classList.contains("active")) renderDay();
  if (!storage.get("planner.notify", false) || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const soon = new Date(now.getTime() + 5 * 60000);
  const t = todayStr();
  for (const task of state.date === t ? state.tasks : []) {
    if (task.done || !task.start) continue;
    const [h, m] = task.start.split(":").map(Number);
    const at = new Date(); at.setHours(h, m, 0, 0);
    const key = `${t}:${task.id}`;
    if (at > now - 60000 && at <= soon && !notified.has(key)) {
      notified.add(key);
      storage.set("planner.notified", [...notified].slice(-200));
      new Notification(task.title, { body: `${fmtRange(task.start, task.end)}${task.notes ? " · " + task.notes.slice(0, 80) : ""}`, icon: "icon.svg", tag: key });
    }
  }
}

let lastSeenDay = todayStr();
setInterval(() => {
  const t = todayStr();
  if (t !== lastSeenDay) {
    // Midnight: if you were looking at "today", follow it to the new day.
    if (state.date === lastSeenDay) state.date = t;
    lastSeenDay = t;
    loadDay();
  } else {
    tick();
  }
}, 30000);
window.addEventListener("focus", () => { loadDay().catch(() => {}); });

// ---------------- navigation ----------------

function showView(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  if (name === "schedule") loadSchedule();
  else loadDay();
  storage.set("planner.view", name);
}
$$(".tab").forEach((t) => (t.onclick = () => showView(t.dataset.view)));
$("#openImport").onclick = openImport;
$("#openSettings").onclick = openSettings;
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  e.preventDefault();
  if (a.dataset.action === "import") openImport();
  if (a.dataset.action === "settings") openSettings();
});

function refreshAll() {
  loadDay().catch((e) => toast(e.message));
  loadSchedule().catch(() => {});
}

(async function init() {
  try {
    await loadSettings();
    await Promise.all([loadDay(), loadSchedule()]);
    renderChat();
    showView(storage.get("planner.view", "day"));
  } catch (err) {
    toast(`Couldn't reach the planner: ${err.message}`);
  }
})();
