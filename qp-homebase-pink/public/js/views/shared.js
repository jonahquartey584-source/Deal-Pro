import { S, today, weekday, addDays, daysBetween, mondayOf, ymd, esc } from "../app.js";

export const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

// ---------- schedule: everything happening on a day ----------
export function dayItems(date) {
  const wd = weekday(date), out = [];
  for (const t of S.tasks) if (t.date === date) out.push({ kind: "task", id: t.id, title: t.title, start: t.start, end: t.end, done: !!t.done, notes: t.notes });
  for (const r of S.routine) if (r.days?.includes(wd) && !(r.skip || []).includes(date)) out.push({ kind: "routine", id: r.id, title: r.title, start: r.start, end: r.end, done: !!S.routineDone[`${date}|${r.id}`] });
  for (const c of S.chores) if (choreOn(c, date)) out.push({ kind: "chore", id: c.id, title: c.title, start: c.start || "", room: c.room, minutes: c.minutes, done: !!S.choreDone[`${date}|${c.id}`] });
  return out.sort((a, b) => (a.start || "99") .localeCompare(b.start || "99") || a.title.localeCompare(b.title));
}
export function choreOn(c, date) { return c.date ? c.date === date : (c.days || []).includes(weekday(date)); }
export function toggleItem(kind, id, date) {
  if (kind === "task") { const t = S.tasks.find((x) => x.id === id); if (t) t.done = !t.done; }
  else if (kind === "routine") { const k = `${date}|${id}`; if (S.routineDone[k]) delete S.routineDone[k]; else S.routineDone[k] = true; }
  else if (kind === "chore") { const k = `${date}|${id}`; if (S.choreDone[k]) delete S.choreDone[k]; else S.choreDone[k] = true; }
}
export function itemRow(it, date) {
  const tag = it.kind === "chore" ? `<span class="tag chore">🧹 ${esc(it.room || "Housework")}</span>` : it.kind === "routine" ? `<span class="tag">↻ weekly</span>` : "";
  return `<li class="item ${it.done ? "done" : ""}">
    <button class="check ${it.done ? "on" : ""}" data-act="toggle" data-kind="${it.kind}" data-id="${it.id}" data-date="${date}" aria-label="Done">${it.done ? "✓" : ""}</button>
    <span class="time">${esc(it.start || "")}</span>
    <span class="t">${esc(it.title)} ${tag}${it.notes ? `<div class="small muted">${esc(it.notes)}</div>` : ""}</span>
  </li>`;
}

// ---------- meals & calories ----------
export const recipeById = (id) => S.recipes.find((r) => r.id === id);
export function mealEntry(date, slot) { return S.mealPlan[date]?.[slot] || null; }
export function mealName(e) { if (!e) return ""; if (e.recipeId) return recipeById(e.recipeId)?.name || "(deleted recipe)"; return e.text || ""; }
export function mealCalories(e) {
  if (!e) return 0;
  if (e.recipeId) { const r = recipeById(e.recipeId); return Math.round((+r?.calories || 0) * (+e.portions || 1)); }
  return +e.calories || 0;
}
export const dayCalories = (date) => SLOTS.reduce((s, k) => s + mealCalories(mealEntry(date, k)), 0);

// "200 g chicken breast" -> { qty: 200, unit: "g", name: "chicken breast" }
const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "cups", "oz", "lb", "pinch", "clove", "cloves", "slice", "slices", "tin", "tins", "can", "cans", "pack", "packs", "bunch"];
export function parseIngredient(line) {
  const s = String(line).trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|½|¼|¾)\s*([a-zA-Z]+)?\.?\s+(.*)$/) || s.match(/^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\s+(.*)$/);
  if (!m) return { qty: null, unit: "", name: s };
  let q = m[1] === "½" ? 0.5 : m[1] === "¼" ? 0.25 : m[1] === "¾" ? 0.75 : m[1].includes("/") ? m[1].split("/")[0] / m[1].split("/")[1] : parseFloat(m[1].replace(",", "."));
  let unit = (m[2] || "").toLowerCase(), name = m[3];
  if (unit && !UNITS.includes(unit)) { name = `${m[2]} ${name}`; unit = ""; }
  return { qty: q, unit, name: name.trim() };
}
export function shoppingFor(from, days = 7) {
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    for (const slot of SLOTS) {
      const e = mealEntry(d, slot);
      if (!e?.recipeId) continue;
      const r = recipeById(e.recipeId); if (!r) continue;
      const factor = (+e.portions || 1) / (+r.servings || 1);
      for (const line of r.ingredients || []) {
        if (!String(line).trim()) continue;
        const p = parseIngredient(line), key = (p.name.toLowerCase() + "|" + p.unit);
        const cur = map.get(key) || { name: p.name, unit: p.unit, qty: 0, hasQty: false, recipes: new Set() };
        if (p.qty != null) { cur.qty += p.qty * factor; cur.hasQty = true; }
        cur.recipes.add(r.name); map.set(key, cur);
      }
    }
  }
  return [...map.entries()].map(([key, v]) => ({ key, label: v.hasQty ? `${+v.qty.toFixed(2)}${v.unit ? " " + v.unit : ""} ${v.name}` : v.name, recipes: [...v.recipes] }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// ---------- cycle ----------
export function cycleInfo(ref = today()) {
  const c = S.cycle, starts = [...c.periods].map((p) => p.start).sort();
  const gaps = starts.slice(1).map((s, i) => daysBetween(starts[i], s)).filter((g) => g >= 18 && g <= 45).slice(-6);
  const avgLen = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : +c.cycleLength || 28;
  const lens = c.periods.filter((p) => p.end).map((p) => daysBetween(p.start, p.end) + 1).filter((n) => n > 0 && n < 12).slice(-6);
  const perLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : +c.periodLength || 5;
  const past = starts.filter((s) => s <= ref);
  const lastStart = past[past.length - 1] || null;
  if (!lastStart) return { avgLen, perLen, lastStart: null };
  let nextStart = addDays(lastStart, avgLen);
  while (nextStart <= ref && daysBetween(lastStart, ref) > avgLen) nextStart = addDays(nextStart, avgLen);
  const dayOf = daysBetween(lastStart, ref) + 1;
  const ovulation = addDays(nextStart, -14);
  return { avgLen, perLen, lastStart, nextStart, dayOf, ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1), daysUntil: daysBetween(ref, nextStart) };
}
export function isPeriodDay(date) {
  return S.cycle.periods.some((p) => date >= p.start && date <= (p.end || addDays(p.start, (cycleInfo().perLen || 5) - 1)));
}

// ---------- Bible reading time ----------
export function timerSeconds() {
  const t = S.bible.timer; if (!t) return 0;
  return (t.accumulated || 0) + (t.running ? (Date.now() - t.startedAt) / 1000 : 0);
}
export function readingOn(date) {
  let s = S.bible.sessions.filter((x) => x.date === date).reduce((a, x) => a + x.seconds, 0);
  if (date === today()) s += timerSeconds();
  return s;
}
export function readingBetween(from, to) { let s = 0; for (let d = from; d <= to; d = addDays(d, 1)) s += readingOn(d); return s; }
export const weekRange = (d = today()) => [mondayOf(d), addDays(mondayOf(d), 6)];
export function monthRange(d = today()) { const x = new Date(d + "T12:00"); return [ymd(new Date(x.getFullYear(), x.getMonth(), 1)), ymd(new Date(x.getFullYear(), x.getMonth() + 1, 0))]; }
export function readingStreak() {
  let n = 0, d = today();
  if (!readingOn(d)) d = addDays(d, -1);
  while (readingOn(d) > 0) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- money ----------
export function monthTx(month) { return S.money.tx.filter((t) => t.date?.startsWith(month)); }
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
