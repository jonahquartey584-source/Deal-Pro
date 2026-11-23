import { S, save, today, addDays, mondayOf, fmtDate, DAY_SHORT, DAY_LONG, esc, uid, openSheet, closeSheet, setParams, rerender, toast, weekday } from "../app.js";
import { dayItems, itemRow, toggleItem, SLOTS, mealEntry, mealName } from "./shared.js";

export const title = "Planner";

export function render(el, p) {
  const date = p.date || today(), tab = p.tab || "day";
  const mon = mondayOf(date);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const seg = `<div class="seg">${[["day", "Day"], ["week", "Week schedule"], ["routine", "Weekly routine"]].map(([k, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>`;
  const nav = `<div class="row spread" style="margin:12px 0 8px"><button class="btn small" data-shift="-7">‹ Week</button><b>${fmtDate(mon, { day: "numeric", month: "short" })} – ${fmtDate(addDays(mon, 6), { day: "numeric", month: "short" })}</b><button class="btn small" data-shift="7">Week ›</button></div>`;
  let body = "";

  if (tab === "day") {
    const items = dayItems(date);
    body = `${nav}<div class="week-strip">${strip.map((d) => `<button class="day-btn ${d === date ? "on" : ""}" data-date="${d}">${DAY_SHORT[weekday(d)]}<b>${+d.slice(8)}</b><span class="dot ${dayItems(d).length ? "show" : ""}"></span></button>`).join("")}</div>
    <div class="card"><div class="row spread"><h2>${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2><button class="btn primary small" data-act="add">+ Add</button></div>
      ${items.length ? `<ul class="list">${items.map((i) => itemRow(i, date).replace("</li>", `<button class="x" data-act="edit" data-kind="${i.kind}" data-id="${i.id}">⋯</button></li>`)).join("")}</ul>` : `<div class="empty">Nothing planned. Tap + Add.</div>`}
      <div class="row wrap" style="margin-top:10px">
        <button class="btn small" data-act="carry">Move yesterday's unfinished here</button>
        ${date !== today() ? `<button class="btn small" data-date="${today()}">Back to today</button>` : ""}
      </div></div>`;
  } else if (tab === "week") {
    body = `${nav}${strip.map((d) => {
      const items = dayItems(d), meals = SLOTS.map((s) => mealEntry(d, s) && `${s[0].toUpperCase() + s.slice(1)}: ${mealName(mealEntry(d, s))}`).filter(Boolean);
      return `<div class="card" style="padding:12px 14px"><div class="row spread"><b>${d === today() ? "Today · " : ""}${fmtDate(d)}</b><button class="btn small ghost" data-date="${d}" data-tab="day">Open ›</button></div>
      ${items.length ? `<ul class="list">${items.map((i) => itemRow(i, d)).join("")}</ul>` : `<div class="small muted" style="padding:6px 0">Free</div>`}
      ${meals.length ? `<div class="small muted" style="margin-top:4px">🍽 ${esc(meals.join(" · "))}</div>` : ""}</div>`;
    }).join("")}`;
  } else {
    body = `<div class="card"><div class="row spread"><h2>Weekly routine</h2><button class="btn primary small" data-act="addRoutine">+ Add</button></div>
      <p class="small muted" style="margin-top:0">These repeat every week and appear in your day automatically.</p>
      ${S.routine.length ? `<ul class="list">${[...S.routine].sort((a, b) => (a.start || "99").localeCompare(b.start || "99")).map((r) => `<li class="item"><span class="time">${esc(r.start || "")}</span><span class="t">${esc(r.title)}<div class="small muted">${r.days.map((d) => DAY_SHORT[d]).join(", ")}${r.end ? ` · until ${esc(r.end)}` : ""}</div></span><button class="x" data-act="editRoutine" data-id="${r.id}">⋯</button></li>`).join("")}</ul>` : `<div class="empty">No routine yet.</div>`}
    </div>
    <div class="card"><h2>Import a schedule</h2>
      <p class="small muted" style="margin-top:0">Paste one item per line, e.g.<br><code>Mon, Thu 18:00-19:00 Gym</code><br><code>2026-12-05 10:30 Dentist</code><br>Or ask Jay to read a messy timetable for you.</p>
      <textarea class="input" id="importText" placeholder="Paste here"></textarea>
      <button class="btn primary" data-act="import" style="margin-top:8px">Import</button></div>`;
  }
  el.innerHTML = `<div style="margin-top:4px">${seg}</div>${body}`;

  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab || b.dataset.date) return setParams({ ...(b.dataset.tab && { tab: b.dataset.tab }), ...(b.dataset.date && { date: b.dataset.date }) });
    if (b.dataset.shift) return setParams({ date: addDays(date, +b.dataset.shift) });
    const a = b.dataset.act;
    if (a === "toggle") { toggleItem(b.dataset.kind, b.dataset.id, b.dataset.date); save(); rerender(); }
    if (a === "add") taskSheet(null, date);
    if (a === "edit") {
      if (b.dataset.kind === "task") taskSheet(S.tasks.find((t) => t.id === b.dataset.id), date);
      else if (b.dataset.kind === "routine") routineSheet(S.routine.find((r) => r.id === b.dataset.id), date);
      else toast("Edit chores in Housework");
    }
    if (a === "addRoutine") routineSheet(null);
    if (a === "editRoutine") routineSheet(S.routine.find((r) => r.id === b.dataset.id));
    if (a === "carry") {
      const y = addDays(date, -1), left = S.tasks.filter((t) => t.date === y && !t.done);
      left.forEach((t) => (t.date = date)); save(); toast(left.length ? `Moved ${left.length} task${left.length > 1 ? "s" : ""}` : "Nothing left over from yesterday"); rerender();
    }
    if (a === "import") {
      const n = importText(el.querySelector("#importText").value); save(); toast(`Imported ${n} item${n === 1 ? "" : "s"}`); rerender();
    }
  };
}

function taskSheet(t, date) {
  const isNew = !t; t ||= { title: "", date, start: "", end: "", notes: "" };
  openSheet(`<h2>${isNew ? "New task" : "Edit task"}</h2>
    <label class="field">What</label><input class="input" id="f_title" value="${esc(t.title)}" autofocus>
    <label class="field">Date</label><input class="input" id="f_date" type="date" value="${t.date}">
    <div class="grid2"><div><label class="field">Start</label><input class="input" id="f_start" type="time" value="${t.start}"></div><div><label class="field">End</label><input class="input" id="f_end" type="time" value="${t.end}"></div></div>
    <label class="field">Notes</label><input class="input" id="f_notes" value="${esc(t.notes)}">
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#ok").onclick = () => {
      const v = (id) => c.querySelector(id).value.trim();
      if (!v("#f_title")) return toast("Give it a name");
      Object.assign(t, { title: v("#f_title"), date: v("#f_date") || date, start: v("#f_start"), end: v("#f_end"), notes: v("#f_notes") });
      if (isNew) S.tasks.push({ id: uid(), done: false, ...t });
      save(); closeSheet(); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { S.tasks = S.tasks.filter((x) => x !== t); save(); closeSheet(); rerender(); });
  });
}

function routineSheet(r, date) {
  const isNew = !r; r ||= { title: "", days: [weekday(today())], start: "", end: "" };
  let days = [...r.days];
  openSheet(`<h2>${isNew ? "New weekly item" : "Edit weekly item"}</h2>
    <label class="field">What</label><input class="input" id="f_title" value="${esc(r.title)}" autofocus>
    <label class="field">Days</label><div class="row wrap" id="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip ${days.includes(d) ? "on" : ""}" data-d="${d}">${DAY_SHORT[d]}</button>`).join("")}</div>
    <div class="grid2"><div><label class="field">Start</label><input class="input" id="f_start" type="time" value="${r.start}"></div><div><label class="field">End</label><input class="input" id="f_end" type="time" value="${r.end}"></div></div>
    <div class="row wrap" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `${date ? `<button class="btn" id="skip">Skip ${DAY_LONG[weekday(date)]} only</button>` : ""}<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#days").onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; const d = +b.dataset.d; days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; b.classList.toggle("on"); };
    c.querySelector("#ok").onclick = () => {
      const v = (id) => c.querySelector(id).value.trim();
      if (!v("#f_title") || !days.length) return toast("Add a name and at least one day");
      Object.assign(r, { title: v("#f_title"), days, start: v("#f_start"), end: v("#f_end") });
      if (isNew) S.routine.push({ id: uid(), ...r });
      save(); closeSheet(); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { S.routine = S.routine.filter((x) => x !== r); save(); closeSheet(); rerender(); });
    c.querySelector("#skip")?.addEventListener("click", () => { (r.skip ||= []).push(date); save(); closeSheet(); rerender(); });
  });
}

const DAY_WORDS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export function importText(text) {
  let n = 0;
  for (const raw of String(text).split(/\n+/)) {
    const line = raw.trim(); if (!line) continue;
    const tm = line.match(/(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/);
    const start = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : "", end = tm?.[3] ? `${tm[3].padStart(2, "0")}:${tm[4]}` : "";
    const dm = line.match(/\d{4}-\d{2}-\d{2}/);
    let rest = line.replace(/\d{4}-\d{2}-\d{2}/, "").replace(tm?.[0] || "§", "");
    if (dm) { S.tasks.push({ id: uid(), date: dm[0], title: rest.replace(/^[\s,:-]+|[\s,:-]+$/g, "") || "Untitled", start, end, notes: "", done: false }); n++; continue; }
    const days = []; rest = rest.replace(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/gi, (w) => { days.push(DAY_WORDS[w.slice(0, 3).toLowerCase()]); return ""; });
    if (/\b(daily|every ?day)\b/i.test(rest)) { days.push(0, 1, 2, 3, 4, 5, 6); rest = rest.replace(/\b(daily|every ?day)\b/i, ""); }
    if (/\bweekdays\b/i.test(rest)) { days.push(1, 2, 3, 4, 5); rest = rest.replace(/\bweekdays\b/i, ""); }
    const title = rest.replace(/^[\s,:&-]+|[\s,:&-]+$/g, "").replace(/\s{2,}/g, " ");
    if (days.length && title) { S.routine.push({ id: uid(), title, days: [...new Set(days)], start, end }); n++; }
  }
  return n;
}
