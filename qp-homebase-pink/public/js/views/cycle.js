import { S, save, today, addDays, fmtDate, esc, rerender, setParams, openSheet, closeSheet, toast, ymd, daysBetween, pad } from "../app.js";
import { cycleInfo } from "./shared.js";

export const title = "Period tracker";
const MOODS = ["😊 Happy", "😌 Calm", "🥰 Loving", "😴 Tired", "😢 Sad", "😤 Irritable", "😰 Anxious", "🤪 Moody", "💪 Energetic"];
const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Back pain", "Tender breasts", "Acne", "Cravings", "Nausea", "Fatigue", "Insomnia", "Spotting", "Discharge"];
const FLOW = ["None", "Light", "Medium", "Heavy"];

// ongoing period (no end yet): show it up to today, at most 10 days
const periodEnd = (p) => p.end || [today(), addDays(p.start, 9)].sort()[0];
const inPeriod = (d) => S.cycle.periods.find((p) => d >= p.start && d <= periodEnd(p));

export function render(el, p) {
  const ci = cycleInfo(), t = today();
  const month = p.month || t.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1), startPad = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => ymd(new Date(y, m - 1, 1 - startPad + i)));
  // predictions for the next few cycles
  const predicted = new Set(), fertile = new Set();
  if (ci.lastStart) {
    for (let k = 0; k < 4; k++) {
      const s = addDays(ci.nextStart, k * ci.avgLen);
      for (let i = 0; i < ci.perLen; i++) predicted.add(addDays(s, i));
      const ov = addDays(s, -14);
      for (let i = -5; i <= 1; i++) fertile.add(addDays(ov, i));
    }
    if (!inPeriod(t)) { const ov = ci.ovulation; for (let i = -5; i <= 1; i++) fertile.add(addDays(ov, i)); }
  }
  const log = S.cycle.logs[t] || {};
  const ringPct = ci.lastStart ? Math.min(100, (ci.dayOf / ci.avgLen) * 100) : 0;
  const ongoing = S.cycle.periods.find((x) => !x.end);
  const phase = !ci.lastStart ? "" : inPeriod(t) ? "Period" : fertile.has(t) ? (t === ci.ovulation ? "Ovulation (est.)" : "Fertile window (est.)") : ci.dayOf < 14 ? "Follicular phase" : "Luteal phase";

  const starts = [...S.cycle.periods].sort((a, b) => b.start.localeCompare(a.start));
  el.innerHTML = `
  <div class="card center">
    <div class="cycle-ring" style="background:conic-gradient(var(--accent) ${ringPct * 3.6}deg, var(--line) 0)"><div>
      ${ci.lastStart ? `<div class="small muted">Cycle day</div><div class="big">${ci.dayOf}</div><div class="small muted">${esc(phase)}</div>` : `<div class="small muted" style="padding:0 10px">Log your period to start predictions</div>`}
    </div></div>
    ${ci.lastStart ? `<div>${ci.daysUntil > 0 ? `Next period in <b>${ci.daysUntil} day${ci.daysUntil === 1 ? "" : "s"}</b> · ${fmtDate(ci.nextStart)}` : ci.daysUntil === 0 ? `<b>Period due today</b>` : `<b>Period ${-ci.daysUntil} day${ci.daysUntil === -1 ? "" : "s"} late</b>`}</div>
    <div class="small muted">Average cycle ${ci.avgLen} days · period ${ci.perLen} days</div>` : ""}
    <div class="row" style="justify-content:center;margin-top:12px;gap:8px">
      ${ongoing ? `<button class="btn primary" data-act="end">Period ended today</button>` : `<button class="btn primary" data-act="start">Period started today</button>`}
      <button class="btn" data-day="${t}">Log today</button>
    </div>
  </div>

  <div class="card">
    <h2>Today</h2>
    ${log.flow || log.mood?.length || log.symptoms?.length || log.notes ? `
      ${log.flow && log.flow !== "None" ? `<div>🩸 ${esc(log.flow)} flow</div>` : ""}
      ${log.mood?.length ? `<div class="row wrap" style="margin:6px 0">${log.mood.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
      ${log.symptoms?.length ? `<div class="row wrap" style="margin:6px 0">${log.symptoms.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
      ${log.notes ? `<div class="small muted">${esc(log.notes)}</div>` : ""}` : `<div class="empty">How are you feeling? Tap “Log today” to add mood and symptoms.</div>`}
  </div>

  <div class="card">
    <div class="row spread"><button class="btn small" data-month="${shiftMonth(month, -1)}">‹</button><b>${first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><button class="btn small" data-month="${shiftMonth(month, 1)}">›</button></div>
    <div class="cal" style="margin-top:10px">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="h">${d}</div>`).join("")}
      ${cells.map((d) => { const cls = [d.slice(0, 7) !== month && "out", d === t && "today", inPeriod(d) ? "period" : predicted.has(d) && d > t ? "predicted" : fertile.has(d) && "fertile", S.cycle.logs[d] && "logged"].filter(Boolean).join(" "); return `<button class="${cls}" data-day="${d}">${+d.slice(8)}</button>`; }).join("")}
    </div>
    <div class="row wrap small muted" style="margin-top:10px;gap:12px"><span><span class="chip on" style="padding:0 8px">&nbsp;</span> Period</span><span><span class="chip" style="padding:0 8px;border:1px dashed var(--accent)">&nbsp;</span> Predicted</span><span><span class="chip" style="padding:0 8px;background:color-mix(in srgb,var(--good) 22%,transparent)">&nbsp;</span> Fertile (est.)</span></div>
  </div>

  <div class="card"><h2>History</h2>
    ${starts.length ? `<ul class="list">${starts.map((x, i) => { const next = starts[i - 1]; return `<li class="item"><span class="t"><b>${fmtDate(x.start, { day: "numeric", month: "short", year: "numeric" })}</b><div class="small muted">${x.end ? `${daysBetween(x.start, x.end) + 1}-day period` : "ongoing"}${next ? ` · ${daysBetween(x.start, next.start)}-day cycle` : ""}</div></span><button class="x" data-del="${x.start}">✕</button></li>`; }).join("")}</ul>` : `<div class="empty">No periods logged yet.</div>`}
    <label class="field">Usual cycle length (used until there's history)</label>
    <div class="grid2"><input class="input" id="cl" type="number" value="${S.cycle.cycleLength}"><input class="input" id="pl" type="number" value="${S.cycle.periodLength}" title="Period length"></div>
    <p class="small muted">Predictions are estimates, not medical advice or contraception.</p>
  </div>`;

  el.onchange = (e) => {
    if (e.target.id === "cl") { S.cycle.cycleLength = +e.target.value || 28; save(); rerender(); }
    if (e.target.id === "pl") { S.cycle.periodLength = +e.target.value || 5; save(); rerender(); }
  };
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.month) return setParams({ month: b.dataset.month });
    if (b.dataset.day) return daySheet(b.dataset.day);
    if (b.dataset.del && confirm("Remove this period?")) { S.cycle.periods = S.cycle.periods.filter((x) => x.start !== b.dataset.del); save(); rerender(); }
    if (b.dataset.act === "start") { S.cycle.periods.push({ start: t, end: null }); setFlow(t); save(); toast("Period logged 🌸"); rerender(); }
    if (b.dataset.act === "end") { const o = S.cycle.periods.find((x) => !x.end); o.end = t < o.start ? o.start : t; save(); toast("Period end saved"); rerender(); }
  };
}

function setFlow(d) { S.cycle.logs[d] ||= {}; if (!S.cycle.logs[d].flow || S.cycle.logs[d].flow === "None") S.cycle.logs[d].flow = "Medium"; }
function shiftMonth(month, n) { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

function markPeriod(d, on) {
  const P = S.cycle.periods;
  if (on) {
    if (inPeriod(d)) return;
    const before = P.find((p) => p.end && addDays(p.end, 1) === d), after = P.find((p) => addDays(p.start, -1) === d);
    if (before && after) { before.end = periodEnd(after); P.splice(P.indexOf(after), 1); }
    else if (before) before.end = d;
    else if (after) after.start = d;
    else P.push({ start: d, end: d });
  } else {
    const p = inPeriod(d); if (!p) return;
    const end = periodEnd(p);
    if (p.start === d && end === d) P.splice(P.indexOf(p), 1);
    else if (p.start === d) p.start = addDays(d, 1);
    else if (end === d) p.end = addDays(d, -1);
    else { P.push({ start: addDays(d, 1), end: p.end }); p.end = addDays(d, -1); }
  }
}

function daySheet(d) {
  const L = structuredClone(S.cycle.logs[d] || {}); L.mood ||= []; L.symptoms ||= [];
  const chips = (arr, sel, key) => arr.map((x) => `<button class="chip ${sel.includes(x) ? "on" : ""}" data-${key}="${esc(x)}">${esc(x)}</button>`).join("");
  openSheet(`<h2>${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}</h2>
    <label class="row" style="gap:10px;margin:8px 0"><input type="checkbox" id="pd" ${inPeriod(d) ? "checked" : ""}> <b>Period day</b></label>
    <label class="field">Flow</label><div class="seg" id="flow">${FLOW.map((f) => `<button class="${(L.flow || "None") === f ? "on" : ""}" data-f="${f}">${f}</button>`).join("")}</div>
    <label class="field">Mood</label><div class="row wrap" id="mood">${chips(MOODS, L.mood, "m")}</div>
    <label class="field">Symptoms</label><div class="row wrap" id="sym">${chips(SYMPTOMS, L.symptoms, "s")}</div>
    <label class="field">Notes</label><textarea class="input" id="notes" placeholder="Anything else…">${esc(L.notes || "")}</textarea>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button><button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#flow").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; L.flow = b.dataset.f; c.querySelectorAll("#flow button").forEach((x) => x.classList.toggle("on", x === b)); if (L.flow !== "None") c.querySelector("#pd").checked = true; };
    const tog = (sel, key, arr) => c.querySelector(sel).onclick = (e) => { const b = e.target.closest(`[data-${key}]`); if (!b) return; const v = b.dataset[key]; const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); b.classList.toggle("on"); };
    tog("#mood", "m", L.mood); tog("#sym", "s", L.symptoms);
    c.querySelector("#ok").onclick = () => {
      L.notes = c.querySelector("#notes").value.trim();
      const empty = (!L.flow || L.flow === "None") && !L.mood.length && !L.symptoms.length && !L.notes;
      if (empty) delete S.cycle.logs[d]; else S.cycle.logs[d] = L;
      markPeriod(d, c.querySelector("#pd").checked);
      save(); closeSheet(); rerender();
    };
  });
}
