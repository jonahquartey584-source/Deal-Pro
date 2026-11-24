import { S, save, today, addDays, fmtDate, esc, uid, rerender, setParams, openSheet, closeSheet, toast, mondayOf } from "../app.js";

export const title = "To-do list";
const PRI = { high: 0, normal: 1, low: 2 };
const PRI_LABEL = { high: "High", normal: "Normal", low: "Low" };
const PRI_DOT = { high: "var(--bad)", normal: "var(--accent)", low: "var(--muted)" };
const FILTERS = [["all", "All"], ["today", "Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["nodate", "No date"], ["done", "Done"]];
const listOf = (x) => x.list || "General";

function matches(x, f, t) {
  if (f === "done") return x.done;
  if (x.done) return false;
  if (f === "today") return x.due === t;
  if (f === "upcoming") return !!x.due && x.due > t;
  if (f === "overdue") return !!x.due && x.due < t;
  if (f === "nodate") return !x.due;
  return true;
}
function groupOf(x, t) {
  if (x.done) return "Done";
  if (!x.due) return "No date";
  if (x.due < t) return "Overdue";
  if (x.due === t) return "Today";
  if (x.due === addDays(t, 1)) return "Tomorrow";
  if (x.due <= addDays(mondayOf(t), 6)) return "This week";
  return "Later";
}
const GROUP_ORDER = ["Overdue", "Today", "Tomorrow", "This week", "Later", "No date", "Done"];

export function render(el, p) {
  const t = today();
  const f = p.f || "all", pri = p.pri || "any", list = p.list || "All", q = (p.q || "").toLowerCase(), sort = p.sort || "due";
  const lists = [...new Set(S.todos.map(listOf))].sort();
  const base = S.todos.filter((x) => (pri === "any" || (x.priority || "normal") === pri) && (list === "All" || listOf(x) === list) && (!q || x.title.toLowerCase().includes(q) || (x.notes || "").toLowerCase().includes(q)));
  const count = (k) => base.filter((x) => matches(x, k, t)).length;
  let items = base.filter((x) => matches(x, f, t));
  const cmp = {
    due: (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || PRI[a.priority || "normal"] - PRI[b.priority || "normal"],
    priority: (a, b) => PRI[a.priority || "normal"] - PRI[b.priority || "normal"] || (a.due || "9999").localeCompare(b.due || "9999"),
    newest: (a, b) => (b.created || "").localeCompare(a.created || "") || 0,
  }[sort];
  items.sort(cmp);
  if (f === "done") items.sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  const groups = {};
  for (const x of items) (groups[sort === "due" ? groupOf(x, t) : (f === "done" ? "Done" : "To do")] ||= []).push(x);
  const order = sort === "due" ? GROUP_ORDER : ["To do", "Done"];
  const open = S.todos.filter((x) => !x.done).length, overdue = S.todos.filter((x) => !x.done && x.due && x.due < t).length;
  const doneToday = S.todos.filter((x) => x.done && (x.doneAt || "").startsWith(t)).length;

  el.innerHTML = `
  <div class="grid3" style="margin-top:6px">
    <button class="stat" data-f="all" style="text-align:left"><div class="k">To do</div><div class="v">${open}</div></button>
    <button class="stat" data-f="overdue" style="text-align:left"><div class="k">Overdue</div><div class="v" style="color:${overdue ? "var(--bad)" : "inherit"}">${overdue}</div></button>
    <button class="stat" data-f="done" style="text-align:left"><div class="k">Done today</div><div class="v" style="color:var(--good)">${doneToday}</div></button>
  </div>

  <div class="card">
    <form id="add" class="row"><input class="input grow" id="t" placeholder="Add a to-do…" autocomplete="off" enterkeyhint="done"><button class="btn primary">Add</button></form>
    <div class="row wrap" style="margin-top:8px" id="quick">
      <button type="button" class="chip" data-due="">No date</button>
      <button type="button" class="chip on" data-due="${t}">Today</button>
      <button type="button" class="chip" data-due="${addDays(t, 1)}">Tomorrow</button>
      <button type="button" class="chip" data-due="${addDays(mondayOf(t), 7)}">Next week</button>
      <input class="input" id="due" type="date" value="${t}" style="width:auto;flex:1;min-width:130px">
    </div>
    <div class="grid2" style="margin-top:8px">
      <select class="input" id="pri"><option value="normal">Normal priority</option><option value="high">High priority</option><option value="low">Low priority</option></select>
      <input class="input" id="list" list="lists" placeholder="List (e.g. Work)" value="${list === "All" ? "" : esc(list)}"><datalist id="lists">${lists.map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
    </div>
  </div>

  <div class="seg" style="margin-top:4px">${FILTERS.map(([k, n]) => `<button class="${f === k ? "on" : ""}" data-f="${k}">${n}${k !== "all" && count(k) ? ` <span class="pill">${count(k)}</span>` : ""}</button>`).join("")}</div>

  <div class="row" style="margin-top:10px">
    <input class="input grow" id="q" type="search" placeholder="Search to-dos" value="${esc(p.q || "")}">
    <select class="input" id="sort" style="width:auto"><option value="due" ${sort === "due" ? "selected" : ""}>By date</option><option value="priority" ${sort === "priority" ? "selected" : ""}>By priority</option><option value="newest" ${sort === "newest" ? "selected" : ""}>Newest</option></select>
  </div>
  <div class="row wrap" style="margin-top:8px">
    ${["any", "high", "normal", "low"].map((k) => `<button class="chip ${pri === k ? "on" : ""}" data-pri="${k}">${k === "any" ? "Any priority" : `<span style="width:8px;height:8px;border-radius:50%;background:${PRI_DOT[k]};display:inline-block"></span> ${PRI_LABEL[k]}`}</button>`).join("")}
  </div>
  ${lists.length > 1 || list !== "All" ? `<div class="row wrap" style="margin-top:8px">${["All", ...lists].map((l) => `<button class="chip ${l === list ? "on" : ""}" data-list="${esc(l)}">${l === "All" ? "All lists" : esc(l)}</button>`).join("")}</div>` : ""}

  ${items.length ? order.filter((g) => groups[g]).map((g) => `
    <div class="card" style="padding:10px 14px">
      <div class="row spread"><b style="color:${g === "Overdue" ? "var(--bad)" : "inherit"}">${g}</b><span class="small muted">${groups[g].length}</span></div>
      <ul class="list">${groups[g].map((x) => row(x, t, list)).join("")}</ul>
    </div>`).join("") : `<div class="card"><div class="empty">${f === "done" ? "Nothing done yet" : q || pri !== "any" || list !== "All" ? "No to-dos match these filters" : "All clear ✨"}</div></div>`}
  ${f === "done" && items.length ? `<button class="btn small" data-act="clear">Clear done</button>` : ""}`;

  let due = t;
  el.querySelector("#quick").onclick = (e) => {
    const b = e.target.closest("[data-due]"); if (!b) return;
    due = b.dataset.due; el.querySelector("#due").value = due;
    el.querySelectorAll("#quick .chip").forEach((c) => c.classList.toggle("on", c === b));
  };
  el.querySelector("#due").onchange = (e) => { due = e.target.value; el.querySelectorAll("#quick .chip").forEach((c) => c.classList.toggle("on", c.dataset.due === due)); };
  el.querySelector("#add").onsubmit = (e) => {
    e.preventDefault();
    const v = el.querySelector("#t").value.trim(); if (!v) return;
    S.todos.push({ id: uid(), title: v, due, priority: el.querySelector("#pri").value, list: el.querySelector("#list").value.trim(), done: false, created: new Date().toISOString() });
    save(); toast("Added"); rerender(); setTimeout(() => document.querySelector("#t")?.focus(), 50);
  };
  el.querySelector("#q").oninput = (e) => { clearTimeout(window.__tq); window.__tq = setTimeout(() => { setParams({ q: e.target.value }); const i = document.querySelector("#q"); i?.focus(); i?.setSelectionRange(99, 99); }, 250); };
  el.querySelector("#sort").onchange = (e) => setParams({ sort: e.target.value });
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b || b.closest("#quick")) return;
    if (b.dataset.f) return setParams({ f: b.dataset.f });
    if (b.dataset.pri) return setParams({ pri: b.dataset.pri });
    if (b.dataset.list) return setParams({ list: b.dataset.list });
    const x = S.todos.find((y) => y.id === b.dataset.id);
    if (b.dataset.act === "toggle" && x) { x.done = !x.done; x.doneAt = x.done ? new Date().toISOString() : ""; save(); if (x.done) toast("Done ✓"); rerender(); }
    if (b.dataset.act === "edit" && x) editSheet(x);
    if (b.dataset.act === "clear" && confirm("Delete all done to-dos?")) { S.todos = S.todos.filter((y) => !y.done); save(); rerender(); }
  };
}

function row(x, t, list) {
  const late = !x.done && x.due && x.due < t;
  const when = x.due ? (x.due === t ? "Today" : x.due === addDays(t, 1) ? "Tomorrow" : x.due === addDays(t, -1) ? "Yesterday" : fmtDate(x.due)) : "";
  const meta = [when && `<span style="${late ? "color:var(--bad)" : ""}">${when}</span>`, list === "All" && x.list && esc(x.list)].filter(Boolean).join(" · ");
  return `<li class="item ${x.done ? "done" : ""}">
    <button class="check ${x.done ? "on" : ""}" data-act="toggle" data-id="${x.id}" aria-label="Done">${x.done ? "✓" : ""}</button>
    <button class="btn ghost" data-act="edit" data-id="${x.id}" style="flex:1;min-width:0;border:0;padding:0;text-align:left;font-weight:400">
      <span class="t" style="display:block"><span style="width:8px;height:8px;border-radius:50%;background:${PRI_DOT[x.priority || "normal"]};display:inline-block;margin-right:6px;vertical-align:middle"></span>${esc(x.title)}
      ${meta ? `<div class="small muted">${meta}</div>` : ""}${x.notes ? `<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.notes)}</div>` : ""}</span>
    </button></li>`;
}

function editSheet(x) {
  openSheet(`<h2>Edit to-do</h2>
    <label class="field">To-do</label><input class="input" id="e_t" value="${esc(x.title)}">
    <div class="grid2"><div><label class="field">Due</label><input class="input" id="e_due" type="date" value="${x.due || ""}"></div>
    <div><label class="field">Priority</label><select class="input" id="e_pri">${Object.keys(PRI_LABEL).map((k) => `<option value="${k}" ${(x.priority || "normal") === k ? "selected" : ""}>${PRI_LABEL[k]}</option>`).join("")}</select></div></div>
    <label class="field">List</label><input class="input" id="e_list" value="${esc(x.list || "")}" placeholder="General">
    <label class="field">Notes</label><textarea class="input" id="e_notes">${esc(x.notes || "")}</textarea>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button><button class="btn danger" id="del">Delete</button><button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#ok").onclick = () => {
      const v = (id) => c.querySelector(id).value.trim();
      if (!v("#e_t")) return toast("Give it a name");
      Object.assign(x, { title: v("#e_t"), due: v("#e_due"), priority: v("#e_pri"), list: v("#e_list"), notes: v("#e_notes") });
      save(); closeSheet(); rerender();
    };
    c.querySelector("#del").onclick = () => { S.todos = S.todos.filter((y) => y !== x); save(); closeSheet(); toast("Deleted"); rerender(); };
  });
}
