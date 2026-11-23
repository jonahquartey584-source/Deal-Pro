import { S, save, go, today, fmtDate, money, dur, esc, rerender } from "../app.js";
import { dayItems, itemRow, toggleItem, dayCalories, SLOTS, mealEntry, mealName, mealCalories, cycleInfo, readingOn, monthTx, sum, timerSeconds } from "./shared.js";

export const title = "Homebase";
export const subtitle = () => fmtDate(today(), { weekday: "long", day: "numeric", month: "long" });

export function render(el) {
  const t = today(), items = dayItems(t), done = items.filter((i) => i.done).length;
  const h = new Date().getHours(), hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const cal = dayCalories(t), target = +S.calorieTarget || 2000;
  const ci = cycleInfo();
  const month = t.slice(0, 7), mtx = monthTx(month);
  const inc = sum(mtx.filter((x) => x.type === "income"), (x) => x.amount), exp = sum(mtx.filter((x) => x.type === "expense"), (x) => x.amount);
  const read = readingOn(t), goal = (+S.bible.goalMinutes || 15) * 60;
  const todos = S.todos.filter((x) => !x.done && x.due && x.due <= t);
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  el.innerHTML = `
  <div class="card">
    <div class="row spread"><div><h2 style="font-size:1.4rem">${hello}, ${esc(S.profile.name || "RubyQp")} 💕</h2>
    <div class="muted small">${items.length ? `${done} of ${items.length} done today` : "Nothing planned yet today"}</div></div>
    <div class="cycle-ring" style="width:64px;height:64px;margin:0;background:conic-gradient(var(--accent) ${pct * 3.6}deg, var(--line) 0)"><div style="width:50px;height:50px;font-weight:700;font-size:.85rem">${pct}%</div></div></div>
  </div>

  <div class="card">
    <div class="row spread"><h2>Today</h2><button class="btn small" data-act="go" data-to="planner">Planner ›</button></div>
    ${items.length ? `<ul class="list">${items.map((i) => itemRow(i, t)).join("")}</ul>` : `<div class="empty">A free day! Add tasks in the Planner or chores in Housework.</div>`}
    ${todos.length ? `<h3>To-dos due</h3><ul class="list">${todos.map((x) => `<li class="item"><button class="check" data-act="todo" data-id="${x.id}"></button><span class="t">${esc(x.title)}</span></li>`).join("")}</ul>` : ""}
  </div>

  <div class="grid2">
    <button class="stat" data-act="go" data-to="meals" style="text-align:left"><div class="k">Calories today</div><div class="v">${cal} <span class="small muted">/ ${target}</span></div><div class="bar ${cal > target ? "over" : ""}" style="margin-top:6px"><i style="width:${Math.min(100, (cal / target) * 100)}%"></i></div></button>
    <button class="stat" data-act="go" data-to="bible" style="text-align:left"><div class="k">Bible today ${S.bible.timer?.running ? "· ⏱ running" : ""}</div><div class="v">${dur(read)}</div><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, (read / goal) * 100)}%"></i></div></button>
    <button class="stat" data-act="go" data-to="cycle" style="text-align:left"><div class="k">Cycle</div><div class="v">${ci.lastStart ? `Day ${ci.dayOf}` : "—"}</div><div class="small muted">${ci.lastStart ? (ci.daysUntil >= 0 ? `Period in ${ci.daysUntil} day${ci.daysUntil === 1 ? "" : "s"}` : "Period due") : "Log your period"}</div></button>
    <button class="stat" data-act="go" data-to="money" style="text-align:left"><div class="k">${new Date().toLocaleDateString("en-GB", { month: "long" })} left</div><div class="v" style="color:${inc - exp < 0 ? "var(--bad)" : "inherit"}">${money(inc - exp)}</div><div class="small muted">In ${money(inc)} · Out ${money(exp)}</div></button>
  </div>

  <div class="card">
    <div class="row spread"><h2>Today's meals</h2><button class="btn small" data-act="go" data-to="meals">Plan ›</button></div>
    ${SLOTS.map((s) => { const e = mealEntry(t, s); return `<div class="slot"><span class="n">${s}</span><span class="grow">${e ? esc(mealName(e)) : `<span class="muted">—</span>`}</span><span class="small muted">${e ? mealCalories(e) + " kcal" : ""}</span></div>`; }).join("")}
  </div>

  <button class="btn primary wide" data-act="go" data-to="jay" style="display:block;margin:14px auto 0">💬 Ask Jay</button>`;

  el.onclick = (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "go") go(b.dataset.to);
    if (b.dataset.act === "toggle") { toggleItem(b.dataset.kind, b.dataset.id, b.dataset.date); save(); rerender(); }
    if (b.dataset.act === "todo") { const x = S.todos.find((y) => y.id === b.dataset.id); if (x) x.done = true; save(); rerender(); }
  };
  // keep the Bible timer card ticking
  const iv = S.bible.timer?.running ? setInterval(() => { const v = el.querySelectorAll(".stat .v")[1]; if (v) v.textContent = dur(readingOn(t)); }, 15000) : null;
  return () => clearInterval(iv);
}
