import { S, save, today, addDays, mondayOf, fmtDate, DAY_SHORT, DAY_LONG, esc, uid, rerender, setParams, openSheet, closeSheet, toast, weekday, go } from "../app.js";
import { choreOn, dayItems, itemRow, toggleItem } from "./shared.js";

export const title = "Housework";
const ROOMS = ["Kitchen", "Bathroom", "Bedroom", "Living room", "Laundry", "Whole house", "Outside"];

export function render(el, p) {
  const tab = p.tab || "chores", date = p.date || today(), mon = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const seg = `<div class="seg" style="margin-top:4px">${[["chores", "My chores"], ["week", "This week"], ["schedule", "Full schedule"]].map(([k, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>`;
  let body = "";

  if (tab === "chores") {
    const unassigned = S.chores.filter((c) => !c.date && !(c.days || []).length);
    body = `<div class="card"><div class="row spread"><h2>Chore list</h2><button class="btn primary small" data-act="add">+ Add chore</button></div>
      <p class="small muted" style="margin-top:0">Add the things that need doing, then give each one a day.</p>
      ${S.chores.length ? `<ul class="list">${S.chores.map((c) => `<li class="item"><span class="t">${esc(c.title)}<div class="small muted">${esc(c.room || "")}${c.minutes ? ` · ${c.minutes} min` : ""} · ${c.date ? fmtDate(c.date) : (c.days || []).length ? "Every " + c.days.map((d) => DAY_SHORT[d]).join(", ") : "<b>No day yet</b>"}</div></span><button class="btn small" data-act="edit" data-id="${c.id}">Edit</button></li>`).join("")}</ul>` : `<div class="empty">No chores yet. Try “Hoover living room”, “Change bed sheets”, “Clean bathroom”.</div>`}
      </div>
      ${unassigned.length ? `<div class="card"><h2>Give these a day</h2>${unassigned.map((c) => `<div style="margin:8px 0"><b>${esc(c.title)}</b><div class="row wrap" style="margin-top:6px">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip" data-assign="${c.id}" data-d="${d}">${DAY_SHORT[d]}</button>`).join("")}</div></div>`).join("")}</div>` : ""}`;
  } else if (tab === "week") {
    const nav = `<div class="row spread" style="margin:12px 0 4px"><button class="btn small" data-shift="-7">‹</button><b>Week of ${fmtDate(mon, { day: "numeric", month: "short" })}</b><button class="btn small" data-shift="7">›</button></div>`;
    body = nav + week.map((d) => {
      const list = S.chores.filter((c) => choreOn(c, d));
      const done = list.filter((c) => S.choreDone[`${d}|${c.id}`]).length;
      return `<div class="card" style="padding:12px 14px"><div class="row spread"><b>${d === today() ? "Today · " : ""}${DAY_LONG[weekday(d)]} ${+d.slice(8)}</b><span class="small muted">${list.length ? `${done}/${list.length}` : ""}</span></div>
        ${list.length ? `<ul class="list">${list.map((c) => { const k = `${d}|${c.id}`, on = !!S.choreDone[k]; return `<li class="item ${on ? "done" : ""}"><button class="check ${on ? "on" : ""}" data-act="toggle" data-kind="chore" data-id="${c.id}" data-date="${d}">${on ? "✓" : ""}</button><span class="t">${esc(c.title)} <span class="small muted">${esc(c.room || "")}</span></span></li>`; }).join("")}</ul>` : `<div class="small muted" style="padding:4px 0">No chores</div>`}</div>`;
    }).join("");
  } else {
    const nav = `<div class="row spread" style="margin:12px 0 4px"><button class="btn small" data-shift="-7">‹</button><b>Everything · week of ${fmtDate(mon, { day: "numeric", month: "short" })}</b><button class="btn small" data-shift="7">›</button></div>`;
    body = nav + `<p class="small muted">All your tasks, weekly routine and chores together.</p>` + week.map((d) => {
      const items = dayItems(d);
      return `<div class="card" style="padding:12px 14px"><b>${d === today() ? "Today · " : ""}${fmtDate(d)}</b>${items.length ? `<ul class="list">${items.map((i) => itemRow(i, d)).join("")}</ul>` : `<div class="small muted" style="padding:4px 0">Free</div>`}</div>`;
    }).join("") + `<button class="btn" data-act="planner" style="width:100%">Add tasks in the Planner ›</button>`;
  }
  el.innerHTML = seg + body;

  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) return setParams({ tab: b.dataset.tab });
    if (b.dataset.shift) return setParams({ date: addDays(date, +b.dataset.shift) });
    if (b.dataset.assign) { const c = S.chores.find((x) => x.id === b.dataset.assign); c.days = [+b.dataset.d]; save(); toast(`${c.title} → ${DAY_LONG[+b.dataset.d]}s`); return rerender(); }
    const a = b.dataset.act;
    if (a === "toggle") { toggleItem(b.dataset.kind, b.dataset.id, b.dataset.date); save(); rerender(); }
    if (a === "add") choreSheet(null);
    if (a === "edit") choreSheet(S.chores.find((c) => c.id === b.dataset.id));
    if (a === "planner") go("planner", { tab: "week" });
  };
}

function choreSheet(c) {
  const isNew = !c; c ||= { title: "", room: "", minutes: "", days: [], date: "", start: "" };
  let days = [...(c.days || [])], mode = c.date ? "once" : "weekly";
  openSheet(`<h2>${isNew ? "New chore" : "Edit chore"}</h2>
    <label class="field">Chore</label><input class="input" id="f_title" value="${esc(c.title)}" autofocus placeholder="e.g. Mop kitchen floor">
    <div class="grid2"><div><label class="field">Room</label><input class="input" id="f_room" list="rooms" value="${esc(c.room)}"><datalist id="rooms">${ROOMS.map((r) => `<option value="${r}">`).join("")}</datalist></div>
    <div><label class="field">Minutes</label><input class="input" id="f_min" type="number" inputmode="numeric" value="${c.minutes || ""}"></div></div>
    <label class="field">When</label>
    <div class="seg" id="mode"><button data-m="weekly" class="${mode === "weekly" ? "on" : ""}">Every week</button><button data-m="once" class="${mode === "once" ? "on" : ""}">One day only</button></div>
    <div id="weekly" ${mode === "weekly" ? "" : "hidden"}><div class="row wrap" id="days" style="margin-top:8px">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip ${days.includes(d) ? "on" : ""}" data-d="${d}">${DAY_SHORT[d]}</button>`).join("")}</div></div>
    <div id="once" ${mode === "once" ? "" : "hidden"}><input class="input" id="f_date" type="date" value="${c.date || today()}" style="margin-top:8px"></div>
    <label class="field">Time (optional)</label><input class="input" id="f_start" type="time" value="${c.start || ""}">
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (s) => {
    s.querySelector("#mode").onclick = (e) => { const b = e.target.closest("[data-m]"); if (!b) return; mode = b.dataset.m; s.querySelectorAll("#mode button").forEach((x) => x.classList.toggle("on", x === b)); s.querySelector("#weekly").hidden = mode !== "weekly"; s.querySelector("#once").hidden = mode !== "once"; };
    s.querySelector("#days").onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; const d = +b.dataset.d; days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; b.classList.toggle("on"); };
    s.querySelector("#ok").onclick = () => {
      const v = (id) => s.querySelector(id).value.trim();
      if (!v("#f_title")) return toast("Name the chore");
      Object.assign(c, { title: v("#f_title"), room: v("#f_room"), minutes: +v("#f_min") || 0, start: v("#f_start"), days: mode === "weekly" ? days : [], date: mode === "once" ? v("#f_date") : "" });
      if (isNew) S.chores.push({ id: uid(), ...c });
      save(); closeSheet(); rerender();
    };
    s.querySelector("#del")?.addEventListener("click", () => { S.chores = S.chores.filter((x) => x !== c); save(); closeSheet(); rerender(); });
  });
}
