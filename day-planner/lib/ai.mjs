// Claude assistant: a chat that can read and change your tasks and schedule
// through tools, and a schedule reader for files the built-in importers can't parse.
import Anthropic from "@anthropic-ai/sdk";
import * as store from "./store.mjs";
import { today, toTimeStr, DAY_NAMES, weekday, isDateStr } from "./dates.mjs";
import { describeItem } from "./importers.mjs";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function keySource() {
  if (store.getState().settings.apiKey) return "settings";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "environment";
  return null;
}

function client() {
  const key = store.getState().settings.apiKey;
  if (key) return new Anthropic({ apiKey: key });
  if (keySource()) return new Anthropic();
  const err = new Error("Add your Anthropic API key in Settings to use the assistant.");
  err.status = 401;
  throw err;
}

const model = () => store.getState().settings.model || "claude-opus-5-5";

// Every request goes through the beta endpoint so a declined request is re-run
// on Anthropic's recommended fallback model instead of failing.
function create(params) {
  return client().beta.messages.create({ betas: [FALLBACK_BETA], fallbacks: "default", model: model(), ...params });
}

export function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return { status: 401, message: "Your Anthropic API key was rejected. Check it in Settings." };
  if (err instanceof Anthropic.PermissionDeniedError) return { status: 403, message: "Your API key doesn't have access to this model. Try another model in Settings." };
  if (err instanceof Anthropic.NotFoundError) return { status: 404, message: `Model "${model()}" wasn't found. Check the model name in Settings.` };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "Rate limited by the Anthropic API. Try again in a minute." };
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: `The Anthropic API rejected the request: ${err.message}` };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, message: "Couldn't reach the Anthropic API. Check your internet connection." };
  if (err instanceof Anthropic.APIError) return { status: 502, message: `Anthropic API error (${err.status}): ${err.message}` };
  return { status: err.status || 500, message: err.message || String(err) };
}

// ---------- tools ----------

const dateProp = { type: "string", description: "Date as YYYY-MM-DD" };
const timeProp = { type: "string", description: "24-hour time HH:MM, or empty string for no set time" };

const TOOLS = [
  {
    name: "list_tasks",
    description: "List the tasks for one day, including ones pulled in from the schedule. Use before changing tasks so you have their ids.",
    input_schema: { type: "object", properties: { date: dateProp }, required: ["date"] },
  },
  {
    name: "add_task",
    description: "Add a one-off task to a day.",
    input_schema: {
      type: "object",
      properties: {
        date: dateProp, title: { type: "string" }, start: timeProp, end: timeProp,
        priority: { type: "string", enum: ["low", "normal", "high"] }, notes: { type: "string" },
      },
      required: ["date", "title"],
    },
  },
  {
    name: "update_task",
    description: "Change a task: mark it done/undone, rename it, change its time, date (to move it), priority or notes. Only include the fields to change.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" }, title: { type: "string" }, date: dateProp, start: timeProp, end: timeProp,
        done: { type: "boolean" }, priority: { type: "string", enum: ["low", "normal", "high"] }, notes: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Remove a task from its day. Ask the user first unless they clearly asked for it to be removed.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "list_schedule",
    description: "List the user's schedule: recurring items (days 0=Sun..6=Sat) and one-off dated items. Tasks are created from these each day.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_schedule_item",
    description: "Add an item to the schedule. Give `days` for something that repeats weekly, or `date` for a one-off.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" }, start: timeProp, end: timeProp,
        days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "Weekdays it repeats on, 0=Sunday" },
        date: dateProp, until: { type: "string", description: "Optional last date YYYY-MM-DD for a repeating item" },
        notes: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["title"],
    },
  },
  {
    name: "update_schedule_item",
    description: "Change a schedule item. Upcoming unfinished tasks made from it are updated too.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" }, title: { type: "string" }, start: timeProp, end: timeProp,
        days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } }, date: dateProp,
        until: { type: "string" }, notes: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_schedule_item",
    description: "Remove an item from the schedule. Ask the user first unless they clearly asked for it.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

const slimTask = (t) => ({
  id: t.id, title: t.title, start: t.start, end: t.end, done: t.done, priority: t.priority,
  ...(t.notes ? { notes: t.notes } : {}), ...(t.scheduleId ? { fromSchedule: true } : {}),
});

const slimItem = (s) => ({
  id: s.id, title: s.title, start: s.start, end: s.end, priority: s.priority,
  ...(s.date ? { date: s.date } : { days: s.days.map((d) => DAY_NAMES[d]) }),
  ...(s.from ? { from: s.from } : {}), ...(s.until ? { until: s.until } : {}),
  ...(s.notes ? { notes: s.notes.slice(0, 300) } : {}),
});

function runTool(name, input) {
  const need = (v) => { if (!v) throw new Error("Not found. List again to get current ids."); return v; };
  switch (name) {
    case "list_tasks":
      if (!isDateStr(input.date)) throw new Error("date must be YYYY-MM-DD");
      return { date: input.date, weekday: DAY_NAMES[weekday(input.date)], tasks: store.tasksForDate(input.date).map(slimTask) };
    case "add_task":
      return slimTask(store.addTask(input));
    case "update_task": {
      const { id, ...patch } = input;
      return slimTask(need(store.updateTask(id, patch)));
    }
    case "delete_task":
      need(store.deleteTask(input.id));
      return { deleted: input.id };
    case "list_schedule":
      return { items: store.getState().schedule.map(slimItem) };
    case "add_schedule_item":
      return slimItem(store.addScheduleItems([input], { source: "assistant" })[0]);
    case "update_schedule_item": {
      const { id, ...patch } = input;
      return slimItem(need(store.updateScheduleItem(id, patch)));
    }
    case "delete_schedule_item":
      need(store.deleteScheduleItem(input.id));
      return { deleted: input.id };
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

const SYSTEM = `You are the assistant inside the user's personal day planner, a task tracker running on their own computer.
Each day's task list is built from the user's schedule (recurring and one-off items they imported or added) plus one-off tasks.
You can read and change tasks and the schedule with your tools. Look things up with the tools rather than guessing ids or times.
When asked to plan a day, look at the tasks and fit them around the fixed-time items; suggest an order and times, and only write the changes if the user asks you to.
When the user tells you about something they need to do, add it as a task. Make changes they clearly ask for without asking for confirmation, then say briefly what you changed.
Keep replies short and practical, and use 24-hour or am/pm times to match how the user writes. Use short lists where they help.`;

// Runs one assistant turn. `messages` is the full conversation (Anthropic message
// params) kept by the browser; returns it with the new turn appended.
export async function chat(messages, viewingDate) {
  if (!Array.isArray(messages) || messages.length === 0) throw Object.assign(new Error("No message"), { status: 400 });
  const convo = structuredClone(messages);
  const last = convo[convo.length - 1];
  if (last.role !== "user" || typeof last.content !== "string") throw Object.assign(new Error("Last message must be the user's text"), { status: 400 });

  const now = new Date();
  const name = store.getState().settings.name;
  // Context goes in the new user message so the cached system prompt stays fixed.
  last.content = [
    { type: "text", text: `[Now: ${DAY_NAMES[now.getDay()]} ${today()} ${toTimeStr(now)}. The user is looking at ${viewingDate || today()}.${name ? ` User's name: ${name}.` : ""}]` },
    { type: "text", text: last.content },
  ];

  let changed = false;
  for (let i = 0; i < 12; i++) {
    const response = await create({
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages: convo,
    });
    convo.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      return { messages: convo, reply: "Sorry, I can't help with that one.", changed };
    }
    if (response.stop_reason !== "tool_use") {
      const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
      return { messages: convo, reply: reply || "(no reply)", changed, truncated: response.stop_reason === "max_tokens" };
    }

    const results = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = runTool(block.name, block.input || {});
        if (!block.name.startsWith("list_")) changed = true;
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: e.message, is_error: true });
      }
    }
    convo.push({ role: "user", content: results });
  }
  return { messages: convo, reply: "I stopped after a lot of steps. Check your tasks, and ask me again if something's missing.", changed };
}

// ---------- reading schedules with Claude ----------

const ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          start: { type: "string", description: "HH:MM 24-hour, or empty" },
          end: { type: "string", description: "HH:MM 24-hour, or empty" },
          date: { type: "string", description: "YYYY-MM-DD for a one-off item, or empty for a repeating one" },
          days: { type: "array", items: { type: "integer" }, description: "Weekdays a repeating item happens on, 0=Sunday..6=Saturday; empty for a one-off" },
          notes: { type: "string" },
        },
        required: ["title", "start", "end", "date", "days", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export async function extractSchedule(text) {
  const now = new Date();
  const response = await create({
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema: ITEMS_SCHEMA } },
    messages: [{
      role: "user",
      content: `Today is ${DAY_NAMES[now.getDay()]} ${today()}. Below is a schedule the user wants to load into their day planner. Extract every task, class, shift, meeting or routine in it as items.
A repeating item (e.g. "every weekday", a weekly timetable) gets "days" and an empty "date"; a one-off gets a "date" and empty "days". Turn relative dates like "next Tuesday" into real dates. Leave out anything already in the past. Put locations or extra details in "notes".

<schedule>
${text.slice(0, 200000)}
</schedule>`,
    }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("Claude couldn't read that schedule."), { status: 422 });
  const textOut = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = JSON.parse(textOut);
  return { format: "ai", items: parsed.items.map((x) => ({ ...x, date: x.date || undefined, days: x.date ? undefined : x.days })), skipped: {} };
}

export { describeItem };
