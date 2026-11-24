import { S, save, go, today, fmtDate, money, dur, esc, rerender, icon } from "../app.js";
import { isLocked } from "../lock.js";
import { dayItems, itemRow, toggleItem, dayCalories, SLOTS, mealEntry, mealName, mealCalories, cycleInfo, readingOn, monthTx, sum } from "./shared.js";

export const title = "Homebase";
export const subtitle = () => fmtDate(today(), { weekday: "long", day: "numeric", month: "long" });

const ring = (pct, label, size = 64) => `<span class="ring-wrap"><span class="ring" style="--p:${Math.max(0, Math.min(100, pct))};--size:${size}px"></span><b>${label}</b></span>`;

export function render(el) {
  const t = today(), items = dayItems(t), done = items.filter((i) => i.done).length;
  const h = new Date().getHours(), hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const cal = dayCalories(t), target = +S.calorieTarget || 2000;
  const ci = cycleInfo();
  const mtx = monthTx(t.slice(0, 7));
  const inc = sum(mtx.filter((x) => x.type === "income"), (x) => x.amount), exp = sum(mtx.filter((x) => x.type === "expense"), (x) => x.amount);
  const read = readingOn(t), goal = (+S.bible.goalMinutes || 15) * 60;
  const todos = S.todos.filter((x) => !x.done && x.due && x.due <= t);
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const openTodos = S.todos.filter((x) => !x.done).length;

  el.innerHTML = `
  <div class="card home-hero">
    <div class="home-logo" role="img" aria-label="Ruby Homebase"></div>
    <div class="hero">
      <div class="grow">
        <h2>${hello}, ${esc(S.profile.name || "RubyQp")}</h2>
        <div class="muted small">${items.length ? `${done} of ${items.length} done today` : "Nothing planned yet today"}</div>
        <div class="love-mini">I love you my smudge <span class="heart">♥</span></div>
      </div>
      ${ring(pct, pct + "%", 70)}
    </div>
  </div>

  <div class="card">
    <div class="row spread"><h2>Today</h2><button class="btn small" data-act="go" data-to="planner">Planner ›</button></div>
    ${items.length ? `<ul class="list">${items.map((i) => itemRow(i, t)).join("")}</ul>` : `<div class="empty">A free day ✨ Add tasks in the Planner or chores in Housework.</div>`}
    ${todos.length ? `<h3>To-dos due</h3><ul class="list">${todos.map((x) => `<li class="item"><button class="check" data-act="todo" data-id="${x.id}"></button><span class="t">${esc(x.title)}</span></li>`).join("")}</ul>` : ""}
  </div>

  <div class="bento">
    <button data-act="go" data-to="meals">
      <span class="label">${icon("flame")} Calories</span>
      <span class="num">${cal.toLocaleString()}<small> / ${target.toLocaleString()}</small></span>
      <span class="bar ${cal > target ? "over" : ""}"><i style="width:${Math.min(100, (cal / target) * 100)}%"></i></span>
    </button>
    <button data-act="go" data-to="bible">
      <span class="label">${icon("bible")} Bible ${S.bible.timer?.running ? "· live" : ""}</span>
      ${isLocked("bible") ? `<span class="num">${icon("lock")}</span><span class="foot">Private</span>` : `<span class="foot"><span class="num" id="bibleNum">${dur(read)}</span>${ring((read / goal) * 100, "", 44)}</span>
      <span>${read >= goal ? "Goal reached 🙏" : `Goal ${S.bible.goalMinutes || 15} min`}</span>`}
    </button>
    <button data-act="go" data-to="cycle">
      <span class="label">${icon("cycle")} Cycle</span>
      ${isLocked("cycle") ? `<span class="num">${icon("lock")}</span><span class="foot">Private</span>` : `<span class="num">${ci.lastStart ? `Day ${ci.dayOf}` : "—"}</span>
      <span class="foot">${ci.lastStart ? (ci.daysUntil > 0 ? `Period in ${ci.daysUntil}d` : ci.daysUntil === 0 ? "Due today" : "Late") : "Log your period"}</span>`}
    </button>
    <button data-act="go" data-to="money">
      <span class="label">${icon("money")} ${new Date().toLocaleDateString("en-GB", { month: "long" })}</span>
      ${isLocked("money") ? `<span class="num">${icon("lock")}</span><span class="foot">Private</span>` : `<span class="num" style="color:${inc - exp < 0 ? "var(--bad)" : "inherit"}">${money(inc - exp).replace(".00", "")}</span>
      <span class="foot">left to spend</span>`}
    </button>
    <button class="wide" data-act="go" data-to="todo">
      <span class="foot"><span class="label">${icon("todo")} To-do list</span><span class="num" style="font-size:1.4rem">${openTodos}<small> open</small></span></span>
    </button>
  </div>

  <div class="card">
    <div class="row spread"><h2>Today's meals</h2><button class="btn small" data-act="go" data-to="meals">Plan ›</button></div>
    ${SLOTS.map((s) => { const e = mealEntry(t, s); return `<div class="slot"><span class="n">${s}</span><span class="grow">${e ? esc(mealName(e)) : `<span class="muted">—</span>`}</span><span class="small muted">${e ? mealCalories(e) + " kcal" : ""}</span></div>`; }).join("")}
  </div>

  <button class="btn primary wide" data-act="go" data-to="jay" style="display:flex;align-items:center;justify-content:center;gap:8px;margin:16px auto 0">${icon("sparkle")} Ask Jay</button>`;

  el.onclick = (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "go") go(b.dataset.to);
    if (b.dataset.act === "toggle") { toggleItem(b.dataset.kind, b.dataset.id, b.dataset.date); save(); rerender(); }
    if (b.dataset.act === "todo") { const x = S.todos.find((y) => y.id === b.dataset.id); if (x) { x.done = true; x.doneAt = new Date().toISOString(); } save(); rerender(); }
  };
  const iv = S.bible.timer?.running ? setInterval(() => { const v = el.querySelector("#bibleNum"); if (v) v.textContent = dur(readingOn(t)); }, 15000) : null;
  return () => clearInterval(iv);
}
