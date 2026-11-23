import { S, save, today, fmtDate, esc, uid, rerender, setParams } from "../app.js";

export const title = "To-do list";
const PRI = { high: "🔴", normal: "", low: "⚪" };

export function render(el, p) {
  const show = p.show || "open", t = today();
  const lists = [...new Set(S.todos.map((x) => x.list || "General"))];
  const list = p.list || "All";
  let items = S.todos.filter((x) => (show === "open" ? !x.done : x.done) && (list === "All" || (x.list || "General") === list));
  items.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority]));

  el.innerHTML = `
  <div class="card">
    <form id="add" class="row"><input class="input grow" id="t" placeholder="Add a to-do…" autocomplete="off"><button class="btn primary">Add</button></form>
    <div class="grid3" style="margin-top:8px">
      <input class="input" id="due" type="date" title="Due date">
      <select class="input" id="pri"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select>
      <input class="input" id="list" list="lists" placeholder="List" value="${list === "All" ? "" : esc(list)}"><datalist id="lists">${lists.map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
    </div>
  </div>
  <div class="seg"><button class="${show === "open" ? "on" : ""}" data-show="open">To do (${S.todos.filter((x) => !x.done).length})</button><button class="${show === "done" ? "on" : ""}" data-show="done">Done</button></div>
  ${lists.length > 1 ? `<div class="row wrap" style="margin-top:10px">${["All", ...lists].map((l) => `<button class="chip ${l === list ? "on" : ""}" data-list="${esc(l)}">${esc(l)}</button>`).join("")}</div>` : ""}
  <div class="card">${items.length ? `<ul class="list">${items.map((x) => `
    <li class="item ${x.done ? "done" : ""}"><button class="check ${x.done ? "on" : ""}" data-act="toggle" data-id="${x.id}">${x.done ? "✓" : ""}</button>
    <span class="t">${PRI[x.priority] || ""} ${esc(x.title)}${x.due || (x.list && list === "All") ? `<div class="small ${x.due && x.due < t && !x.done ? "" : "muted"}" style="${x.due && x.due < t && !x.done ? "color:var(--bad)" : ""}">${x.due ? (x.due === t ? "Today" : fmtDate(x.due)) : ""}${x.list && list === "All" ? ` · ${esc(x.list)}` : ""}</div>` : ""}</span>
    <button class="x" data-act="del" data-id="${x.id}" aria-label="Delete">✕</button></li>`).join("")}</ul>` : `<div class="empty">${show === "open" ? "All clear ✨" : "Nothing done yet"}</div>`}
    ${show === "done" && items.length ? `<button class="btn small" data-act="clear" style="margin-top:8px">Clear done</button>` : ""}
  </div>`;

  el.querySelector("#add").onsubmit = (e) => {
    e.preventDefault();
    const v = el.querySelector("#t").value.trim(); if (!v) return;
    S.todos.push({ id: uid(), title: v, due: el.querySelector("#due").value, priority: el.querySelector("#pri").value, list: el.querySelector("#list").value.trim(), done: false, created: t });
    save(); rerender(); setTimeout(() => document.querySelector("#t")?.focus(), 50);
  };
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.show) return setParams({ show: b.dataset.show });
    if (b.dataset.list) return setParams({ list: b.dataset.list });
    const x = S.todos.find((y) => y.id === b.dataset.id);
    if (b.dataset.act === "toggle" && x) { x.done = !x.done; save(); rerender(); }
    if (b.dataset.act === "del") { S.todos = S.todos.filter((y) => y !== x); save(); rerender(); }
    if (b.dataset.act === "clear") { S.todos = S.todos.filter((y) => !y.done); save(); rerender(); }
  };
}
