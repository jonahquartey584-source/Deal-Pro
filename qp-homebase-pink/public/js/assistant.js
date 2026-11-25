// Jay's brain for Ruby Homebase, built from Qp Homebase's Jay (lib/ai.mjs):
// the same personality, the same three OpenAI models (quick → smarter →
// smartest, escalating only when a request is hard), live streamed answers,
// web search for anything current, and tools for everything in her app.
// Runs on her phone with her OpenAI key (Responses API, plain fetch), or on
// the MacBook server. Email is left out on purpose.

export const TIERS = [
  { model: "gpt-6-luna", effort: "none", name: "Luna (quick)" },
  { model: "gpt-6.1-terra", effort: "low", name: "Terra (smarter)" },
  { model: "gpt-6.2-sol", effort: "medium", name: "Sol (smartest)" },
];
export const DEFAULT_MODEL = ""; // empty = let Jay choose between the three
const BASE = "https://api.openai.com/v1";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); };
const weekday = (s) => new Date(s + "T12:00").getDay();
const mondayOf = (s) => addDays(s, -((weekday(s) + 6) % 7));

// ---------- tools ----------
const date = { type: "string", description: "Date as YYYY-MM-DD" };
const time = { type: "string", description: "24-hour time HH:MM, or empty string for no set time" };
const days = { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekdays, 0 = Sunday … 6 = Saturday" };
const T = (name, description, properties = {}, required = [], section) => ({ name, description, parameters: { type: "object", properties, required }, section });

const TOOLS = [
  T("get_day", "One day in her planner: timed tasks, weekly routine items and housework chores (with ids and done/not done), to-dos due that day, and that day's meals. Use before changing things so you have the ids.", { date }, ["date"]),
  T("add_task", "Add a one-off task or appointment to a day in the planner.", { date, title: { type: "string" }, start: time, end: time, notes: { type: "string" } }, ["date", "title"]),
  T("update_task", "Change a planner task: tick it off/untick it, rename, move to another date or time, notes. Only include fields to change. For a weekly routine item or a chore pass its id and the date to tick it off for that day.", { id: { type: "string" }, date, done: { type: "boolean" }, title: { type: "string" }, start: time, end: time, notes: { type: "string" } }, ["id"]),
  T("delete_task", "Remove a one-off planner task. Ask first unless she clearly asked for it.", { id: { type: "string" } }, ["id"]),
  T("add_routine", "Add a repeating weekly item to the planner (e.g. gym every Mon and Thu at 18:00).", { title: { type: "string" }, days, start: time, end: time }, ["title", "days"]),
  T("list_todos", "Her to-do list: open ones (default) or done ones, with id, due date, priority and list.", { show: { type: "string", enum: ["open", "done", "all"] } }),
  T("add_todo", "Add an item to her to-do list (no set time; use add_task for things at a time).", { title: { type: "string" }, due: date, priority: { type: "string", enum: ["low", "normal", "high"] }, list: { type: "string", description: "e.g. Work, Personal" } }, ["title"]),
  T("update_todo", "Tick off, untick, reword or reschedule a to-do. Only include fields to change.", { id: { type: "string" }, done: { type: "boolean" }, title: { type: "string" }, due: date, priority: { type: "string", enum: ["low", "normal", "high"] }, list: { type: "string" } }, ["id"]),
  T("delete_todo", "Remove a to-do. Ask first unless she clearly asked for it.", { id: { type: "string" } }, ["id"]),
  T("add_chore", "Add a housework chore: give weekdays for a weekly chore, or a date for a one-off.", { title: { type: "string" }, days, date, room: { type: "string" }, minutes: { type: "integer" } }, ["title"]),
  T("get_meal_plan", "Her food planner: saved recipes (name, calories per serving, servings, favourite, ingredients) and the meal plan for the week starting on a Monday, plus her daily calorie goal.", { from: { type: "string", description: "Monday of the week, YYYY-MM-DD. Defaults to this week." } }),
  T("save_recipe", "Save a recipe (or update one by id). Ingredients one per item with amounts, like \"200 g chicken breast\", so the shopping list adds them up. Only when she asks.", { id: { type: "string" }, name: { type: "string" }, servings: { type: "integer" }, calories: { type: "integer", description: "Per serving" }, ingredients: { type: "array", items: { type: "string" } }, method: { type: "string" }, fav: { type: "boolean" } }, ["name"]),
  T("plan_meal", "Put a meal in the plan for a day and slot: a saved recipe (recipeName) or a quick meal as text with calories. Leave recipe and text out to clear the slot.", { date, slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }, recipeName: { type: "string" }, text: { type: "string" }, calories: { type: "integer" }, portions: { type: "number" } }, ["date", "slot"]),
  T("add_shopping_item", "Add an extra item to her shopping list.", { name: { type: "string" } }, ["name"]),
  T("get_budget", "Her money for a month: income and spending (with categories and notes), what's left, category budgets and savings goals.", { month: { type: "string", description: "YYYY-MM, default this month" } }, [], "money"),
  T("log_money", "Log income or an expense in her budget.", { type: { type: "string", enum: ["income", "expense"] }, amount: { type: "number" }, category: { type: "string" }, date, note: { type: "string" }, monthly: { type: "boolean", description: "Repeats every month" } }, ["type", "amount"], "money"),
  T("add_savings_goal", "Create a savings goal.", { name: { type: "string" }, target: { type: "number" }, deadline: date, saved: { type: "number" } }, ["name", "target"], "money"),
  T("read_journal", "Read her private journal between two dates (inclusive). Only when she asks about her journal, mood or reflections.", { from: date, to: date }, ["from", "to"], "journal"),
  T("add_journal", "Write a journal entry for her, only when she asks you to.", { date, text: { type: "string" }, mood: { type: "string", description: "One emoji" } }, ["text"], "journal"),
  T("get_cycle", "Her period tracker: cycle day, average cycle and period length, next period and fertile window estimates, and recent logs (flow, mood, symptoms). Only when she asks about her cycle or period.", {}, [], "cycle"),
  T("get_bible", "Her Bible reading time (today, this week, this month, streak, daily goal) and her Bible note titles.", {}, [], "bible"),
  T("add_bible_note", "Save a Bible note for her (title, scripture reference, text).", { title: { type: "string" }, ref: { type: "string" }, body: { type: "string" } }, ["title"], "bible"),
];
const READS = /^(get_|list_|read_)/;

function ensure(d) {
  d.tasks ??= []; d.routine ??= []; d.routineDone ??= {}; d.todos ??= []; d.chores ??= []; d.choreDone ??= {};
  d.recipes ??= []; d.journal ??= []; d.mealPlan ??= {}; d.shopping ??= { checked: {}, extra: [] }; d.shopping.extra ??= [];
  d.money ??= { tx: [], goals: [], budgets: {} }; d.money.tx ??= []; d.money.goals ??= [];
  d.cycle ??= { periods: [], logs: {} }; d.bible ??= { folders: [], notes: [], sessions: [] }; d.bible.notes ??= []; d.bible.sessions ??= [];
  return d;
}
const choreOn = (c, dt) => (c.date ? c.date === dt : (c.days || []).includes(weekday(dt)));
function dayView(d, dt) {
  const wd = weekday(dt), meals = d.mealPlan[dt] || {};
  const mealName = (e) => (e?.recipeId ? d.recipes.find((r) => r.id === e.recipeId)?.name : e?.text) || "";
  return {
    date: dt, weekday: DAYS[wd],
    tasks: d.tasks.filter((t) => t.date === dt).map((t) => ({ id: t.id, title: t.title, start: t.start, end: t.end, done: !!t.done, notes: t.notes || undefined })),
    routine: d.routine.filter((r) => r.days?.includes(wd) && !(r.skip || []).includes(dt)).map((r) => ({ id: r.id, title: r.title, start: r.start, end: r.end, done: !!d.routineDone[`${dt}|${r.id}`] })),
    chores: d.chores.filter((c) => choreOn(c, dt)).map((c) => ({ id: c.id, title: c.title, room: c.room, done: !!d.choreDone[`${dt}|${c.id}`] })),
    todos_due: d.todos.filter((t) => !t.done && t.due === dt).map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    meals: Object.fromEntries(["breakfast", "lunch", "dinner", "snack"].filter((s) => meals[s]).map((s) => [s, mealName(meals[s])])),
  };
}
function readingOn(d, dt) { return Math.round(d.bible.sessions.filter((x) => x.date === dt).reduce((a, x) => a + x.seconds, 0) / 60); }

function runTool(d, name, a, today) {
  switch (name) {
    case "get_day": return dayView(d, a.date || today);
    case "add_task": { const t = { id: id(), date: a.date || today, title: a.title, start: a.start || "", end: a.end || "", notes: a.notes || "", done: false }; d.tasks.push(t); return { added: t.id }; }
    case "update_task": {
      const t = d.tasks.find((x) => x.id === a.id);
      if (t) { for (const k of ["title", "date", "start", "end", "notes", "done"]) if (a[k] !== undefined) t[k] = a[k]; return { updated: t.id }; }
      const dt = a.date || today;
      if (d.routine.some((r) => r.id === a.id)) { const k = `${dt}|${a.id}`; if (a.done === false) delete d.routineDone[k]; else d.routineDone[k] = true; return { ticked: a.id, date: dt }; }
      if (d.chores.some((c) => c.id === a.id)) { const k = `${dt}|${a.id}`; if (a.done === false) delete d.choreDone[k]; else d.choreDone[k] = true; return { ticked: a.id, date: dt }; }
      throw new Error("No task with that id");
    }
    case "delete_task": { const n = d.tasks.length; d.tasks = d.tasks.filter((x) => x.id !== a.id); if (n === d.tasks.length) throw new Error("No task with that id"); return { deleted: a.id }; }
    case "add_routine": { const r = { id: id(), title: a.title, days: a.days, start: a.start || "", end: a.end || "" }; d.routine.push(r); return { added: r.id }; }
    case "list_todos": { const show = a.show || "open"; return d.todos.filter((t) => show === "all" || (show === "done" ? t.done : !t.done)).slice(0, 60).map((t) => ({ id: t.id, title: t.title, due: t.due || undefined, priority: t.priority, list: t.list || undefined, done: !!t.done })); }
    case "add_todo": { const t = { id: id(), title: a.title, due: a.due || "", priority: a.priority || "normal", list: a.list || "", done: false, created: new Date().toISOString() }; d.todos.push(t); return { added: t.id }; }
    case "update_todo": { const t = d.todos.find((x) => x.id === a.id); if (!t) throw new Error("No to-do with that id"); for (const k of ["title", "due", "priority", "list"]) if (a[k] !== undefined) t[k] = a[k]; if (a.done !== undefined) { t.done = a.done; t.doneAt = a.done ? new Date().toISOString() : ""; } return { updated: t.id }; }
    case "delete_todo": { d.todos = d.todos.filter((x) => x.id !== a.id); return { deleted: a.id }; }
    case "add_chore": { const c = { id: id(), title: a.title, days: a.date ? [] : (a.days || []), date: a.date || "", room: a.room || "", minutes: a.minutes || 0 }; d.chores.push(c); return { added: c.id }; }
    case "get_meal_plan": {
      const from = a.from || mondayOf(today);
      const plan = {}; for (let i = 0; i < 7; i++) { const dt = addDays(from, i); plan[dt] = dayView(d, dt).meals; }
      return { calorieGoal: d.calorieTarget || 2000, recipes: d.recipes.map((r) => ({ id: r.id, name: r.name, calories: r.calories, servings: r.servings, fav: !!r.fav, ingredients: r.ingredients })), week: plan };
    }
    case "save_recipe": {
      let r = a.id && d.recipes.find((x) => x.id === a.id);
      if (!r) { r = { id: id(), name: a.name, ingredients: [], method: "", calories: 0, servings: 1, fav: true, image: "" }; d.recipes.push(r); }
      for (const k of ["name", "ingredients", "method", "calories", "servings", "fav"]) if (a[k] !== undefined) r[k] = a[k];
      return { saved: r.id };
    }
    case "plan_meal": {
      d.mealPlan[a.date] ??= {};
      if (!a.recipeName && !a.text) { delete d.mealPlan[a.date][a.slot]; return { cleared: true }; }
      const q = (a.recipeName || "").toLowerCase();
      const r = q && (d.recipes.find((x) => x.name.toLowerCase() === q) || d.recipes.find((x) => x.name.toLowerCase().includes(q)));
      d.mealPlan[a.date][a.slot] = r ? { recipeId: r.id, portions: a.portions || 1 } : { text: a.text || a.recipeName, calories: a.calories || 0 };
      return { planned: r ? r.name : a.text || a.recipeName, savedRecipe: !!r };
    }
    case "add_shopping_item": { d.shopping.extra.push({ id: id(), name: a.name, done: false }); return { added: a.name }; }
    case "get_budget": {
      const m = a.month || today.slice(0, 7), tx = d.money.tx.filter((t) => t.date?.startsWith(m));
      const sum = (t) => tx.filter((x) => x.type === t).reduce((s, x) => s + (+x.amount || 0), 0);
      return { month: m, income: sum("income"), spending: sum("expense"), left: sum("income") - sum("expense"), transactions: tx.slice(-40).map((t) => ({ type: t.type, amount: t.amount, category: t.category, date: t.date, note: t.note })), budgets: d.money.budgets, goals: d.money.goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved, deadline: g.deadline })) };
    }
    case "log_money": { d.money.tx.push({ id: id(), type: a.type, amount: Math.abs(+a.amount || 0), category: a.category || "Other", date: a.date || today, note: a.note || "", monthly: !!a.monthly }); return { logged: true }; }
    case "add_savings_goal": { d.money.goals.push({ id: id(), name: a.name, target: +a.target, saved: +a.saved || 0, deadline: a.deadline || "", emoji: "🎯", contributions: [] }); return { added: a.name }; }
    case "read_journal": return d.journal.filter((j) => j.date >= a.from && j.date <= a.to).map((j) => ({ date: j.date, mood: j.mood, text: j.text }));
    case "add_journal": { d.journal.push({ id: id(), date: a.date || today, time: new Date().toTimeString().slice(0, 5), mood: a.mood || "", text: a.text }); return { saved: true }; }
    case "get_cycle": {
      const starts = d.cycle.periods.map((p) => p.start).sort(), last = starts[starts.length - 1];
      const len = +d.cycle.cycleLength || 28, recent = Object.entries(d.cycle.logs || {}).sort().slice(-10);
      if (!last) return { note: "No periods logged yet." };
      const dayOf = Math.round((new Date(today + "T12:00") - new Date(last + "T12:00")) / 864e5) + 1, next = addDays(last, len);
      return { lastPeriodStart: last, cycleDay: dayOf, averageCycleDays: len, nextPeriodEstimate: next, ovulationEstimate: addDays(next, -14), recentLogs: Object.fromEntries(recent) };
    }
    case "get_bible": {
      const wk = mondayOf(today); let week = 0, month = 0;
      for (let i = 0; i < 7; i++) week += readingOn(d, addDays(wk, i));
      for (const s of d.bible.sessions) if (s.date?.startsWith(today.slice(0, 7))) month += s.seconds / 60;
      return { todayMinutes: readingOn(d, today), weekMinutes: week, monthMinutes: Math.round(month), dailyGoalMinutes: d.bible.goalMinutes || 15, notes: d.bible.notes.slice(-30).map((n) => ({ title: n.title, ref: n.ref })) };
    }
    case "add_bible_note": { d.bible.notes.push({ id: id(), folderId: "", title: a.title, ref: a.ref || "", body: a.body || "", updated: new Date().toISOString(), created: new Date().toISOString() }); return { saved: a.title }; }
  }
  throw new Error(`Unknown tool ${name}`);
}

// ---------- personality (from Qp Homebase's Jay, for RubyQp) ----------
const SYSTEM = `You are Jay, RubyQp's personal assistant inside Ruby Homebase (Qp Homebase "Ruby Edition"), her home base for the day. Think JARVIS crossed with a sharp, easy-going friend who happens to be brilliant at organising: warm, quick, a little witty, and genuinely on her side.

How you talk (this matters most):
- Sound like a real person texting or chatting, not a system. Use contractions, everyday words and a relaxed, natural rhythm. British English and £.
- React like a human first, then help: "Ooh, busy day." "Nice, that's sorted." "Ah, that's annoying." Keep it genuine, not cheesy.
- Never sound like a log: no "Task added successfully", "I have updated the following", "Certainly!", "As an AI". Say it how a friend would: "Done, I've put the dentist in for 3pm tomorrow."
- Be actually helpful: notice things and offer the obvious next step ("You've got a free evening, want me to pop meal prep in?"). Ask a quick follow-up only when it really helps.
- Match her energy: short and punchy for quick stuff, more thoughtful when she wants advice or is stressed. Be kind and encouraging when she's busy or tired.
- Use her name (Ruby) now and then, naturally, not every message.
- Plain chatty sentences by default; only use a short list when there are genuinely several items (like a day's plan).
- Answer anything, not just planner stuff: advice, ideas, recipes, writing, maths, recommendations, or just a chat, like a great friend who knows a lot. Use web search for anything current or factual you might not know (news, weather, prices, opening hours, events). Never say you can't browse; just look it up.

What's in her app: a planner (timed tasks plus a weekly routine), a to-do list, housework chores given to days, a meal planner (saved recipes, a weekly plan, a shopping list, calories), a budget (income, spending, category budgets, savings goals), a private journal, a period tracker, and Bible notes with a reading timer.
Look things up with the tools rather than guessing ids or times. Make changes she clearly asks for without asking for confirmation, then tell her casually what you did, in a sentence.
When asked to plan her day, look at the day and fit things around the fixed-time items; suggest an order and times, and only write changes if she asks.
For her cycle or health: be warm and practical, never diagnose; for real worries suggest her GP or a pharmacist.
Some messages are spoken aloud to her by voice; those are marked. Then talk exactly like you would out loud to a friend: one to three easy sentences, natural spoken English with little fillers where they fit ("right", "okay so", "nice"), no lists, headings, links, emoji or symbols, and numbers and times said the way people say them ("half three", "quarter past ten").

Examples of the tone (not scripts):
"add gym tomorrow at 6" → "Done, gym's in for 6 tomorrow. Want me to plan something easy for dinner after?"
"what's on today" → "Pretty chilled one: work 9 till 5, then the bathroom's due a clean. Want me to swap that to tomorrow?"
"I'm so tired" → "Aw, sorry, Ruby. You've had a packed week. Want me to push anything non-urgent to tomorrow so you can have an early one?"`;

const NEEDS_WEB = /\b(weather|rain|forecast|temperature|news|latest|today'?s|tonight|score|match|price|cost|how much|open(ing)? (hours|times)|is .* open|near me|nearby|search|look up|google|who (is|was|won)|when (is|does|did)|what happened|traffic|train|flight|exchange rate|release|trending|update on)\b/i;
const SMARTEST = /\b(in[- ]depth|detailed (plan|analysis|breakdown|report)|business plan|strateg(y|ies|ic)|research|pros and cons|compare\b.+\b(and|vs\.?|versus|or)\b|step[- ]by[- ]step plan|essay|proposal|financial (plan|forecast)|forecast)\b/i;
const SMARTER = /\b(plan (my|the|out|a)|organi[sz]e|reschedul|prioriti[sz]|rearrange|write (a|an|me|up)|draft|explain|why\b|how (do|does|can|should|would)|calculat|work out|budget|advice|advise|help me (decide|figure|think|choose)|summar(y|is|iz)|ideas? for|brainstorm|review|improve|rewrite|meal plan|savings plan)\b/i;
export function pickTier(text, voice = false) {
  const t = String(text || "");
  let tier = 0;
  if (SMARTEST.test(t) || t.length > 1200) tier = 2;
  else if (SMARTER.test(t) || t.length > 350) tier = 1;
  if (voice) tier = 0; // spoken answers start on the quick model (it can still hand over)
  return tier;
}
const ESCALATE_TOOL = {
  type: "function", name: "escalate", strict: false,
  description: "Hand this request to a more capable model. Call it FIRST, before any other tool, only when the request needs careful multi-step reasoning, long or polished writing, detailed planning across many items, tricky maths, or analysis you aren't sure about. Never use it for quick lookups, adding or changing things, simple questions, the weather or news, or small talk.",
  parameters: { type: "object", properties: { level: { type: "string", enum: ["smarter", "smartest"] }, reason: { type: "string" } }, required: ["level"] },
};
const ESCALATE_NOTE = "\nYou are the quick model. Handle everyday requests yourself, fast. If a request is genuinely hard for you (see the escalate tool), call escalate first instead of giving a weak answer.";
const thinks = (m) => /^(gpt-[56]|o\d)/.test(m);

// ---------- OpenAI ----------
async function openai(apiKey, body, onDelta) {
  let res;
  try {
    res = await fetch(`${BASE}/responses`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...(onDelta ? { stream: true } : {}) }) });
  } catch { throw Object.assign(new Error("Couldn't reach OpenAI. Check your internet connection."), { status: 502 }); }
  if (res.ok && onDelta && /event-stream/.test(res.headers.get("content-type") || "")) return readStream(res, onDelta);
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j;
  const msg = j.error?.message || `OpenAI error ${res.status}`;
  if (res.status === 400 && body.reasoning && /reasoning/i.test(msg)) { const { reasoning, ...rest } = body; return openai(apiKey, rest, onDelta); }
  if (res.status === 401) throw Object.assign(new Error("Your OpenAI API key was rejected. Check it in Settings."), { status: 401 });
  if (j.error?.code === "insufficient_quota" || /quota|billing/i.test(msg)) throw Object.assign(new Error("The OpenAI account is out of credit, so Jay can't answer right now. Add credit at platform.openai.com → Settings → Billing, then try again."), { status: 402 });
  if (res.status === 429) throw Object.assign(new Error("OpenAI says slow down. Try again in a minute."), { status: 429 });
  if (res.status === 404 || (/model/i.test(msg) && res.status === 400)) throw Object.assign(new Error(`OpenAI: ${msg}. Check the model name in Settings.`), { status: 400 });
  throw Object.assign(new Error(`OpenAI: ${msg}`), { status: 502 });
}
async function readStream(res, onDelta) {
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "", done = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === "response.output_text.delta" && ev.delta) { try { onDelta(ev.delta); } catch { /* fine */ } }
      else if (ev.type === "response.completed" || ev.type === "response.incomplete") done = ev.response;
      else if (ev.type === "response.failed" || ev.type === "error") throw Object.assign(new Error(`OpenAI: ${ev.response?.error?.message || ev.message || "the reply failed"}`), { status: 502 });
    }
    if (end) break;
  }
  if (!done) throw Object.assign(new Error("OpenAI's reply was cut off. Try again."), { status: 502 });
  return done;
}
const outputText = (r) => (r.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []).filter((c) => c.type === "output_text").map((c) => c.text).join("\n\n").trim();

/**
 * One turn with Jay. messages: [{role, content}] plain text history (last is hers).
 * Returns { reply, changed, data, model }. onDelta streams the reply as it's written.
 */
export async function runAssistant({ apiKey, model, messages, data, today, now, voice = false, hidden = [], onDelta }) {
  const d = ensure(structuredClone(data || {}));
  today ||= ymd(new Date());
  const pinned = (model || "").trim();
  const history = messages.filter((m) => m && typeof m.content === "string" && m.content.trim()).slice(-30);
  const last = history.pop();
  if (!last || last.role === "assistant") throw Object.assign(new Error("No message"), { status: 400 });
  const snap = dayView(d, today);
  const context = `[Now: ${DAYS[weekday(today)]} ${today}${now ? ` ${now}` : ""}. Her name: RubyQp (Ruby).${voice ? " Spoken by voice: your reply will be read aloud, so keep it short and conversational." : ""}${hidden.length ? ` These sections are locked with Face ID right now, so you can't see or change them: ${hidden.join(", ")}.` : ""}]\n[Snapshot of today: ${JSON.stringify(snap)}. Answer from this when you can; only call tools for other days or more detail.]`;
  let input = [...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })), { role: "user", content: `${context}\n${last.content}` }];
  const fnTools = TOOLS.filter((t) => !t.section || !hidden.includes(t.section)).map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters, strict: false }));
  let tools = [...fnTools, ...(NEEDS_WEB.test(last.content) ? [{ type: "web_search" }] : [])];
  let tier = pickTier(last.content, voice), previous, changed = false;
  const used = new Set();
  const done = (reply) => ({ reply, changed, data: d, model: [...used].join(" → ") });
  for (let i = 0; i < 14; i++) {
    const t = TIERS[tier], m = pinned || t.model;
    used.add(m);
    const canEscalate = !pinned && tier < TIERS.length - 1;
    let r;
    try {
      r = await openai(apiKey, {
        model: m, instructions: SYSTEM + (canEscalate ? ESCALATE_NOTE : ""), input,
        tools: canEscalate ? [...tools, ESCALATE_TOOL] : tools,
        ...(previous ? { previous_response_id: previous } : {}),
        ...(thinks(m) ? { reasoning: { effort: pinned ? "low" : t.effort } } : {}),
        ...(voice ? { max_output_tokens: 400 } : {}),
      }, onDelta);
    } catch (e) {
      if (e.status === 400 && /web_search/i.test(e.message) && tools.some((x) => x.type === "web_search")) { tools = tools.filter((x) => x.type !== "web_search"); i--; continue; }
      throw e;
    }
    const calls = (r.output || []).filter((o) => o.type === "function_call");
    if (!calls.length) return done(outputText(r) || "(no reply)");
    previous = r.id; input = [];
    for (const c of calls) {
      if (c.name === "escalate") {
        let level = "smarter"; try { level = JSON.parse(c.arguments || "{}").level || level; } catch { /* fine */ }
        tier = Math.min(TIERS.length - 1, Math.max(tier + 1, level === "smartest" ? 2 : 1));
        input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify({ ok: true, note: `Now answering with ${TIERS[tier].name}. Carry on with her request.` }) });
        continue;
      }
      let out;
      try {
        const tool = TOOLS.find((x) => x.name === c.name);
        if (tool?.section && hidden.includes(tool.section)) throw new Error("That section is locked with Face ID. Ask her to unlock it first.");
        out = JSON.stringify(runTool(d, c.name, JSON.parse(c.arguments || "{}"), today));
        if (!READS.test(c.name)) changed = true;
      } catch (e) { out = JSON.stringify({ error: e.message }); }
      input.push({ type: "function_call_output", call_id: c.call_id, output: out });
    }
  }
  return done("I stopped after a lot of steps. Have a look, and ask me again if something's missing.");
}

// ---------- Jay's voice (OpenAI, from lib/tts.mjs) ----------
export const VOICES = ["onyx", "ash", "echo", "fable", "ballad", "verse", "cedar"];
const TTS_MODEL = "gpt-4o-mini-tts";
const STYLE = "Voice: a relaxed, friendly guy in his late twenties with a natural British accent, chatting with a friend he likes helping out. " +
  "Tone: warm, easy-going and genuine, with a smile in the voice; a touch of humour where it fits. " +
  "Delivery: conversational, like real speech, not reading: natural rhythm, small pauses between thoughts, varied intonation, slightly quicker on light bits and slower when it matters. " +
  "Never sound robotic, flat, formal, announcer-like or over-excited.";
export const PACE = {
  normal: "Pace: relaxed and unhurried, a normal easy conversational speed.",
  quick: "Pace: slightly upbeat, a touch quicker than normal, but never rushed.",
  fast: "Pace: brisk and lively, like an upbeat chat, never slow or drawn out.",
};
export async function speechClip(apiKey, text, voice = "onyx", speed = "quick") {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, voice: VOICES.includes(voice) ? voice : "onyx", input: String(text).slice(0, 4000), instructions: `${STYLE} ${PACE[speed] || PACE.quick} Sound: clear, smooth, studio quality.`, response_format: "mp3" }),
  });
  if (!res.ok) {
    let msg = ""; try { msg = (await res.json())?.error?.message || ""; } catch { /* fine */ }
    if (res.status === 401) throw Object.assign(new Error("OpenAI didn't accept the API key. Check it in Settings."), { status: 401 });
    if (res.status === 429 && /quota|billing|credit/i.test(msg)) throw Object.assign(new Error("The OpenAI account has no credit left for Jay's voice. Add some at platform.openai.com → Billing."), { status: 402 });
    throw Object.assign(new Error(`OpenAI voice error (${res.status})${msg ? `: ${msg}` : ""}`), { status: 502 });
  }
  return URL.createObjectURL(await res.blob());
}
