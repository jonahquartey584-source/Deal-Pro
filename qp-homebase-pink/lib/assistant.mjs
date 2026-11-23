// Jay, the built-in assistant. Talks to Claude through the Messages API with
// plain fetch (no SDK needed) and can add things to the app through tools.
const API = "https://api.anthropic.com/v1/messages";
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const date = { type: "string", description: "YYYY-MM-DD" };
const time = { type: "string", description: "24-hour HH:MM, or empty" };
const days = { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekdays, 0 = Sunday … 6 = Saturday" };

const TOOLS = [
  { name: "add_task", description: "Add a one-off task or appointment to the planner on a date.",
    input_schema: { type: "object", properties: { date, title: { type: "string" }, start: time, end: time, notes: { type: "string" } }, required: ["date", "title"] } },
  { name: "add_routine", description: "Add a repeating weekly item to the planner schedule (e.g. gym every Mon and Thu at 18:00).",
    input_schema: { type: "object", properties: { title: { type: "string" }, days, start: time, end: time }, required: ["title", "days"] } },
  { name: "add_todo", description: "Add an item to the to-do list.",
    input_schema: { type: "object", properties: { title: { type: "string" }, due: date, priority: { type: "string", enum: ["low", "normal", "high"] } }, required: ["title"] } },
  { name: "add_chore", description: "Add a housework chore. Give weekdays for a weekly chore, or a date for a one-off.",
    input_schema: { type: "object", properties: { title: { type: "string" }, days, date, room: { type: "string" }, minutes: { type: "integer" } }, required: ["title"] } },
  { name: "plan_meal", description: "Put a meal in the weekly meal plan. Use recipe_name to match a saved recipe; otherwise text and calories.",
    input_schema: { type: "object", properties: { date, slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }, recipe_name: { type: "string" }, text: { type: "string" }, calories: { type: "integer" } }, required: ["date", "slot"] } },
  { name: "add_recipe", description: "Save a recipe. Ingredients one per line like '200 g chicken breast'. Calories per serving.",
    input_schema: { type: "object", properties: { name: { type: "string" }, ingredients: { type: "array", items: { type: "string" } }, method: { type: "string" }, calories: { type: "integer" }, servings: { type: "integer" }, fav: { type: "boolean" } }, required: ["name"] } },
  { name: "add_shopping_item", description: "Add an extra item to the shopping list.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "log_money", description: "Log income or an expense in the budget.",
    input_schema: { type: "object", properties: { type: { type: "string", enum: ["income", "expense"] }, amount: { type: "number" }, category: { type: "string" }, date, note: { type: "string" } }, required: ["type", "amount"] } },
  { name: "add_journal", description: "Write a journal entry.",
    input_schema: { type: "object", properties: { date, text: { type: "string" }, mood: { type: "string" } }, required: ["text"] } },
];

function ensure(d) {
  d.tasks ??= []; d.routine ??= []; d.todos ??= []; d.chores ??= []; d.recipes ??= []; d.journal ??= [];
  d.mealPlan ??= {}; d.shopping ??= { checked: {}, extra: [] }; d.shopping.extra ??= [];
  d.money ??= { tx: [], goals: [], budgets: {} }; d.money.tx ??= [];
  return d;
}

function applyTool(d, name, a, today) {
  switch (name) {
    case "add_task": d.tasks.push({ id: id(), date: a.date || today, title: a.title, start: a.start || "", end: a.end || "", notes: a.notes || "", done: false }); return `Added "${a.title}" on ${a.date}.`;
    case "add_routine": d.routine.push({ id: id(), title: a.title, days: a.days, start: a.start || "", end: a.end || "" }); return `Added weekly "${a.title}".`;
    case "add_todo": d.todos.push({ id: id(), title: a.title, due: a.due || "", priority: a.priority || "normal", done: false, created: today }); return `Added to-do "${a.title}".`;
    case "add_chore": d.chores.push({ id: id(), title: a.title, days: a.date ? [] : (a.days || []), date: a.date || "", room: a.room || "", minutes: a.minutes || 0 }); return `Added chore "${a.title}".`;
    case "plan_meal": {
      const r = a.recipe_name && d.recipes.find((x) => x.name.toLowerCase() === a.recipe_name.toLowerCase())
        || (a.recipe_name && d.recipes.find((x) => x.name.toLowerCase().includes(a.recipe_name.toLowerCase())));
      d.mealPlan[a.date] ??= {};
      d.mealPlan[a.date][a.slot] = r ? { recipeId: r.id } : { text: a.text || a.recipe_name || "", calories: a.calories || 0 };
      return r ? `Planned ${r.name} for ${a.slot} on ${a.date}.` : `Planned "${a.text || a.recipe_name}" for ${a.slot} on ${a.date} (not a saved recipe).`;
    }
    case "add_recipe": d.recipes.push({ id: id(), name: a.name, ingredients: a.ingredients || [], method: a.method || "", calories: a.calories || 0, servings: a.servings || 1, fav: a.fav ?? true, image: "" }); return `Saved recipe ${a.name}.`;
    case "add_shopping_item": d.shopping.extra.push({ id: id(), name: a.name, done: false }); return `Added ${a.name} to the shopping list.`;
    case "log_money": d.money.tx.push({ id: id(), type: a.type, amount: Math.abs(+a.amount || 0), category: a.category || "Other", date: a.date || today, note: a.note || "" }); return `Logged ${a.type} £${a.amount}.`;
    case "add_journal": d.journal.push({ id: id(), date: a.date || today, text: a.text, mood: a.mood || "" }); return "Journal entry saved.";
  }
  return "Unknown tool";
}

function summary(d, today) {
  const upcoming = (d.tasks || []).filter((t) => t.date >= today).slice(0, 40);
  return JSON.stringify({
    name: d.profile?.name, today,
    tasks: upcoming, routine: d.routine, todos: (d.todos || []).filter((t) => !t.done),
    chores: d.chores, recipes: (d.recipes || []).map((r) => ({ name: r.name, fav: r.fav, calories: r.calories })),
    mealPlan: Object.fromEntries(Object.entries(d.mealPlan || {}).filter(([k]) => k >= today).slice(0, 14)),
    calorieTarget: d.calorieTarget, budgets: d.money?.budgets, goals: d.money?.goals,
    recentMoney: (d.money?.tx || []).slice(-30),
  });
}

export async function runAssistant({ apiKey, model, messages, data, today, now }) {
  const d = ensure(structuredClone(data || {}));
  today ||= new Date().toISOString().slice(0, 10);
  const wd = DAYS[new Date(today + "T12:00").getDay()];
  const system = `You are Jay, the warm, upbeat assistant inside Qp Homebase, a private personal app (planner, to-dos, housework, meal planner, period tracker, budget, Bible notes and journal). Today is ${wd} ${today}${now ? `, time ${now}` : ""}. Use British English and £. Keep replies short and friendly, phone-sized. When asked to add or plan things, use the tools, then confirm briefly. Never give medical diagnoses; for health worries suggest a GP.\n\nHer current data:\n${summary(d, today)}`;
  const convo = messages.filter((m) => m && typeof m.content === "string" && m.content.trim()).slice(-20)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  let changed = false;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 2000, system, tools: TOOLS, messages: convo }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(r.status === 401 ? "Your Anthropic API key was rejected. Check it in Settings." : `Claude error (${r.status}): ${body?.error?.message || "unknown"}`);
      err.status = r.status === 401 ? 401 : 502; throw err;
    }
    convo.push({ role: "assistant", content: body.content });
    const uses = body.content.filter((b) => b.type === "tool_use");
    if (body.stop_reason !== "tool_use" || !uses.length) {
      const reply = body.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { reply, changed, data: d };
    }
    const results = uses.map((u) => {
      let out; try { out = applyTool(d, u.name, u.input || {}, today); changed = true; } catch (e) { out = "Error: " + e.message; }
      return { type: "tool_result", tool_use_id: u.id, content: out };
    });
    convo.push({ role: "user", content: results });
  }
  return { reply: "Done.", changed, data: d };
}
