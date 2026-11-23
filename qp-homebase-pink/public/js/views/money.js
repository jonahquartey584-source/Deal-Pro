import { S, save, today, fmtDate, esc, uid, rerender, setParams, openSheet, closeSheet, toast, money, pad, daysBetween } from "../app.js";
import { monthTx, sum } from "./shared.js";

export const title = "Budget";
const EXP_CATS = ["Food & groceries", "Rent / mortgage", "Bills", "Transport", "Eating out", "Shopping", "Beauty", "Health", "Church / giving", "Subscriptions", "Fun", "Gifts", "Other"];
const INC_CATS = ["Salary", "Side hustle", "Gift", "Refund", "Other"];
const shiftMonth = (month, n) => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthName = (month, opts = { month: "long", year: "numeric" }) => new Date(month + "-01T12:00").toLocaleDateString("en-GB", opts);

// Regular (monthly) items repeat into each new month automatically.
function addRecurring() {
  const cur = today().slice(0, 7); let added = 0;
  for (const tx of S.money.tx.filter((x) => x.monthly && !x.fromId)) {
    for (let m = shiftMonth(tx.date.slice(0, 7), 1); m <= cur; m = shiftMonth(m, 1)) {
      if (S.money.tx.some((x) => x.fromId === tx.id && x.date.startsWith(m))) continue;
      const day = Math.min(+tx.date.slice(8), new Date(+m.slice(0, 4), +m.slice(5), 0).getDate());
      const date = `${m}-${pad(day)}`; if (date > today()) continue;
      S.money.tx.push({ ...tx, id: uid(), date, fromId: tx.id, monthly: false }); added++;
    }
  }
  if (added) save();
}

export function render(el, p) {
  addRecurring();
  const tab = p.tab || "overview", month = p.month || today().slice(0, 7);
  const tx = monthTx(month).sort((a, b) => b.date.localeCompare(a.date));
  const inc = sum(tx.filter((x) => x.type === "income"), (x) => x.amount), exp = sum(tx.filter((x) => x.type === "expense"), (x) => x.amount);
  const seg = `<div class="seg" style="margin-top:4px">${[["overview", "Overview"], ["log", "Transactions"], ["save", "Savings plans"]].map(([k, n]) => `<button class="${tab === k ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>`;
  const nav = `<div class="row spread" style="margin:12px 0 4px"><button class="btn small" data-month="${shiftMonth(month, -1)}">‹</button><b>${monthName(month)}</b><button class="btn small" data-month="${shiftMonth(month, 1)}">›</button></div>`;
  let body = "";

  if (tab === "overview") {
    const byCat = {};
    for (const x of tx.filter((x) => x.type === "expense")) byCat[x.category] = (byCat[x.category] || 0) + +x.amount;
    const cats = [...new Set([...Object.keys(byCat), ...Object.keys(S.money.budgets).filter((k) => +S.money.budgets[k] > 0)])].sort((a, b) => (byCat[b] || 0) - (byCat[a] || 0));
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
    const trend = months.map((m) => { const t = monthTx(m); return { m, inc: sum(t.filter((x) => x.type === "income"), (x) => x.amount), exp: sum(t.filter((x) => x.type === "expense"), (x) => x.amount) }; });
    const maxT = Math.max(1, ...trend.flatMap((t) => [t.inc, t.exp]));
    body = nav + `
    <div class="grid3"><div class="stat"><div class="k">In</div><div class="v" style="color:var(--good)">${money(inc)}</div></div><div class="stat"><div class="k">Out</div><div class="v">${money(exp)}</div></div><div class="stat"><div class="k">Left</div><div class="v" style="color:${inc - exp < 0 ? "var(--bad)" : "inherit"}">${money(inc - exp)}</div></div></div>
    <button class="btn primary" data-act="add" style="width:100%;margin-top:12px">+ Log income or expense</button>
    <div class="card"><div class="row spread"><h2>Spending by category</h2><button class="btn small" data-act="budgets">Set budgets</button></div>
      ${cats.length ? cats.map((c) => { const spent = byCat[c] || 0, b = +S.money.budgets[c] || 0; return `<div style="margin:10px 0"><div class="row spread small"><span>${esc(c)}</span><span>${money(spent)}${b ? ` <span class="muted">/ ${money(b)}</span>` : ""}</span></div><div class="bar ${b && spent > b ? "over" : ""}" style="margin-top:4px"><i style="width:${b ? Math.min(100, (spent / b) * 100) : Math.min(100, (spent / Math.max(exp, 1)) * 100)}%"></i></div>${b && spent > b ? `<div class="small" style="color:var(--bad)">${money(spent - b)} over budget</div>` : ""}</div>`; }).join("") : `<div class="empty">No spending logged this month.</div>`}
    </div>
    <div class="card"><h2>Last 6 months</h2>
      <div class="bars" style="height:130px">${trend.map((t) => `<div><span style="display:flex;gap:2px;align-items:flex-end;height:100%;width:100%"><i style="flex:1;border-radius:4px 4px 2px 2px;height:${(t.inc / maxT) * 100}%;background:var(--good);min-height:2px"></i><i style="flex:1;border-radius:4px 4px 2px 2px;height:${(t.exp / maxT) * 100}%;background:var(--accent);min-height:2px"></i></span>${monthName(t.m, { month: "short" })}</div>`).join("")}</div>
      <div class="small muted" style="margin-top:6px"><span style="color:var(--good)">■</span> income &nbsp; <span style="color:var(--accent)">■</span> spending</div>
    </div>`;
  } else if (tab === "log") {
    body = nav + `<button class="btn primary" data-act="add" style="width:100%;margin-top:8px">+ Log income or expense</button>
    <div class="card">${tx.length ? `<ul class="list">${tx.map((x) => `<li class="item"><button class="btn ghost" data-edit="${x.id}" style="flex:1;border:0;padding:0;text-align:left;display:flex;gap:10px;align-items:center">
      <span class="t"><b>${esc(x.note || x.category)}</b><div class="small muted">${fmtDate(x.date)} · ${esc(x.category)}${x.monthly || x.fromId ? " · ↻ monthly" : ""}</div></span>
      <b style="color:${x.type === "income" ? "var(--good)" : "inherit"}">${x.type === "income" ? "+" : "−"}${money(x.amount)}</b></button></li>`).join("")}</ul>` : `<div class="empty">Nothing logged for ${monthName(month)}.</div>`}</div>`;
  } else {
    const last3 = [1, 2, 3].map((i) => shiftMonth(today().slice(0, 7), -i)).map((m) => { const t = monthTx(m); return { inc: sum(t.filter((x) => x.type === "income"), (x) => x.amount), exp: sum(t.filter((x) => x.type === "expense"), (x) => x.amount) }; }).filter((x) => x.inc || x.exp);
    const avgInc = last3.length ? sum(last3, (x) => x.inc) / last3.length : inc, avgExp = last3.length ? sum(last3, (x) => x.exp) / last3.length : exp;
    const spare = Math.max(0, avgInc - avgExp);
    body = `
    <div class="card"><h2>Your savings plan</h2>
      <p class="small muted" style="margin-top:0">${last3.length ? `Based on your last ${last3.length} month${last3.length > 1 ? "s" : ""}` : "Based on this month"}: average income ${money(avgInc)}, spending ${money(avgExp)}.</p>
      <div class="grid3"><div class="stat"><div class="k">Needs (50%)</div><div class="v">${money(avgInc * 0.5)}</div></div><div class="stat"><div class="k">Wants (30%)</div><div class="v">${money(avgInc * 0.3)}</div></div><div class="stat"><div class="k">Save (20%)</div><div class="v" style="color:var(--good)">${money(avgInc * 0.2)}</div></div></div>
      <p class="small" style="margin-bottom:0">${avgInc ? (spare >= avgInc * 0.2 ? `💚 You have about <b>${money(spare)}</b> left each month — you can comfortably save ${money(avgInc * 0.2)}.` : spare > 0 ? `You have about <b>${money(spare)}</b> spare a month. Saving that is a great start; trimming “wants” would get you to the 20% goal.` : `You're spending more than you earn at the moment. Check the categories in Overview to find something to trim.`) : "Log your income to get a suggested plan."}</p>
    </div>
    <div class="row spread" style="margin-top:6px"><h2 style="font-size:1.1rem">Goals</h2><button class="btn primary small" data-act="goal">+ New goal</button></div>
    ${S.money.goals.length ? S.money.goals.map((g) => {
      const left = Math.max(0, g.target - g.saved), pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
      const monthsLeft = g.deadline ? Math.max(1, Math.ceil(daysBetween(today(), g.deadline) / 30.44)) : null;
      const perMonth = monthsLeft ? left / monthsLeft : null;
      const eta = spare > 0 && !g.deadline ? Math.ceil(left / (spare / Math.max(1, S.money.goals.length))) : null;
      return `<div class="card"><div class="row spread"><b>${esc(g.emoji || "🎯")} ${esc(g.name)}</b><button class="x" data-goal="${g.id}">⋯</button></div>
        <div class="row spread small" style="margin:6px 0"><span>${money(g.saved)} saved</span><span class="muted">of ${money(g.target)}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="small muted" style="margin-top:8px">${left <= 0 ? "🎉 Goal reached!" : perMonth != null ? `Save <b style="color:var(--text)">${money(perMonth)}/month</b> (${money(perMonth / 4.35)}/week) to reach it by ${fmtDate(g.deadline, { day: "numeric", month: "short", year: "numeric" })}.` : eta ? `At your current spare money, about ${eta} month${eta > 1 ? "s" : ""} to go.` : "Add a target date to get a monthly amount."}</div>
        <div class="row" style="margin-top:10px"><button class="btn small primary" data-pay="${g.id}">+ Add money</button>${(g.contributions || []).length ? `<span class="small muted">Last: ${money(g.contributions.at(-1).amount)} on ${fmtDate(g.contributions.at(-1).date)}</span>` : ""}</div></div>`;
    }).join("") : `<div class="card"><div class="empty">Create a goal — emergency fund, holiday, a new phone — and I'll work out how much to put away each month.</div></div>`}`;
  }
  el.innerHTML = seg + body;

  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) return setParams({ tab: b.dataset.tab });
    if (b.dataset.month) return setParams({ month: b.dataset.month });
    if (b.dataset.act === "add") txSheet(null);
    if (b.dataset.edit) txSheet(S.money.tx.find((x) => x.id === b.dataset.edit));
    if (b.dataset.act === "budgets") budgetSheet();
    if (b.dataset.act === "goal") goalSheet(null);
    if (b.dataset.goal) goalSheet(S.money.goals.find((g) => g.id === b.dataset.goal));
    if (b.dataset.pay) {
      const g = S.money.goals.find((x) => x.id === b.dataset.pay), v = parseFloat(prompt(`How much are you adding to ${g.name}? (£)`, "") || "");
      if (v) { g.saved = +(g.saved + v).toFixed(2); (g.contributions ||= []).push({ date: today(), amount: v }); save(); toast(`${money(v)} added 💰`); rerender(); }
    }
  };
}

function txSheet(x) {
  const isNew = !x; x ||= { type: "expense", amount: "", category: EXP_CATS[0], date: today(), note: "", monthly: false };
  let type = x.type;
  const catOpts = () => (type === "income" ? INC_CATS : EXP_CATS).map((c) => `<option ${c === x.category ? "selected" : ""}>${c}</option>`).join("");
  openSheet(`<h2>${isNew ? "Log money" : "Edit"}</h2>
    <div class="seg" id="ty"><button data-t="expense" class="${type === "expense" ? "on" : ""}">Expense</button><button data-t="income" class="${type === "income" ? "on" : ""}">Income</button></div>
    <label class="field">Amount (£)</label><input class="input" id="amt" type="number" inputmode="decimal" step="0.01" value="${x.amount}" autofocus style="font-size:1.4rem">
    <label class="field">Category</label><select class="input" id="cat">${catOpts()}</select>
    <label class="field">What for</label><input class="input" id="note" value="${esc(x.note)}" placeholder="e.g. Tesco, Netflix, wages">
    <label class="field">Date</label><input class="input" id="date" type="date" value="${x.date}">
    <label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" id="mon" ${x.monthly ? "checked" : ""}> Repeats every month (bills, salary, subscriptions)</label>
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#ty").onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; c.querySelectorAll("#ty button").forEach((y) => y.classList.toggle("on", y === b)); c.querySelector("#cat").innerHTML = catOpts(); };
    c.querySelector("#ok").onclick = () => {
      const amt = Math.abs(parseFloat(c.querySelector("#amt").value)); if (!amt) return toast("Enter an amount");
      Object.assign(x, { type, amount: amt, category: c.querySelector("#cat").value, note: c.querySelector("#note").value.trim(), date: c.querySelector("#date").value || today(), monthly: c.querySelector("#mon").checked });
      if (isNew) S.money.tx.push({ id: uid(), ...x });
      save(); closeSheet(); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { S.money.tx = S.money.tx.filter((y) => y !== x); save(); closeSheet(); rerender(); });
  });
}

function budgetSheet() {
  openSheet(`<h2>Monthly budgets</h2><p class="small muted" style="margin-top:0">Leave blank for no limit.</p>
    ${EXP_CATS.map((c) => `<div class="row" style="margin:6px 0"><span class="grow">${c}</span><input class="input" data-b="${c}" type="number" inputmode="decimal" style="width:110px" placeholder="£" value="${S.money.budgets[c] || ""}"></div>`).join("")}
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button><button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#ok").onclick = () => { c.querySelectorAll("[data-b]").forEach((i) => { const v = parseFloat(i.value); if (v > 0) S.money.budgets[i.dataset.b] = v; else delete S.money.budgets[i.dataset.b]; }); save(); closeSheet(); rerender(); };
  });
}

function goalSheet(g) {
  const isNew = !g; g ||= { name: "", emoji: "🎯", target: "", saved: 0, deadline: "" };
  openSheet(`<h2>${isNew ? "New savings goal" : "Edit goal"}</h2>
    <div class="row"><input class="input" id="em" value="${esc(g.emoji)}" style="width:60px;text-align:center"><input class="input grow" id="n" placeholder="e.g. Emergency fund" value="${esc(g.name)}" autofocus></div>
    <div class="grid2"><div><label class="field">Target (£)</label><input class="input" id="t" type="number" inputmode="decimal" value="${g.target}"></div><div><label class="field">Already saved (£)</label><input class="input" id="s" type="number" inputmode="decimal" value="${g.saved}"></div></div>
    <label class="field">Target date (optional)</label><input class="input" id="d" type="date" value="${g.deadline}">
    <div class="row" style="margin-top:14px"><button class="btn primary grow" id="ok">Save</button>${isNew ? "" : `<button class="btn danger" id="del">Delete</button>`}<button class="btn" data-close>Cancel</button></div>`, (c) => {
    c.querySelector("#ok").onclick = () => {
      const name = c.querySelector("#n").value.trim(), target = parseFloat(c.querySelector("#t").value);
      if (!name || !target) return toast("Add a name and a target");
      Object.assign(g, { name, emoji: c.querySelector("#em").value.trim() || "🎯", target, saved: parseFloat(c.querySelector("#s").value) || 0, deadline: c.querySelector("#d").value });
      if (isNew) S.money.goals.push({ id: uid(), contributions: [], ...g });
      save(); closeSheet(); rerender();
    };
    c.querySelector("#del")?.addEventListener("click", () => { if (!confirm("Delete this goal?")) return; S.money.goals = S.money.goals.filter((y) => y !== g); save(); closeSheet(); rerender(); });
  });
}
