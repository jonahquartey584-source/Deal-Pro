// Persistent storage in a single JSON file, plus the logic that turns schedule
// items into the day's tasks.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  today, weekday, isDateStr, normalizeTime, normalizeDate, normalizeDays,
} from "./dates.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.PLANNER_DATA_DIR || path.join(here, "..", "data");
const DB_FILE = path.join(DATA_DIR, "planner.json");

const DEFAULT_STATE = {
  version: 1,
  settings: { apiKey: "", model: "claude-opus-5-5", name: "" },
  schedule: [],
  tasks: [],
};

let state = null;

export const newId = () => crypto.randomUUID().slice(0, 8);

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    state = { ...structuredClone(DEFAULT_STATE), ...raw };
    state.settings = { ...DEFAULT_STATE.settings, ...(raw.settings || {}) };
  } else {
    state = structuredClone(DEFAULT_STATE);
    save();
  }
  return state;
}

export function save() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const getState = () => state;

// ---------- schedule ----------

const PRIORITIES = ["low", "normal", "high"];

// Cleans user/AI/import input into a schedule item. A schedule item is either a
// one-off (has `date`) or recurring (has `days`, optional `from`/`until`).
export function cleanScheduleItem(input, existing = {}) {
  const item = { ...existing };
  if (input.title !== undefined) item.title = String(input.title).trim().slice(0, 200);
  if (input.start !== undefined) item.start = normalizeTime(input.start);
  if (input.end !== undefined) item.end = normalizeTime(input.end);
  if (input.notes !== undefined) item.notes = String(input.notes || "").slice(0, 2000);
  if (input.priority !== undefined) item.priority = PRIORITIES.includes(input.priority) ? input.priority : "normal";
  if (input.date !== undefined) item.date = normalizeDate(input.date);
  if (input.days !== undefined) item.days = normalizeDays(input.days);
  if (input.from !== undefined) item.from = normalizeDate(input.from);
  if (input.until !== undefined) item.until = normalizeDate(input.until);
  if (input.exceptions !== undefined) item.exceptions = (input.exceptions || []).map(normalizeDate).filter(Boolean);
  if (input.source !== undefined) item.source = String(input.source).slice(0, 100);
  if (input.uid !== undefined) item.uid = String(input.uid).slice(0, 300);
  item.title ||= "Untitled";
  item.start ||= "";
  item.end ||= "";
  item.notes ||= "";
  item.priority ||= "normal";
  item.days ||= [];
  item.date ||= "";
  // Nothing says when: treat as an everyday routine.
  if (!item.date && item.days.length === 0) item.days = [0, 1, 2, 3, 4, 5, 6];
  if (item.date) item.days = [];
  return item;
}

export function appliesTo(item, date) {
  if (item.date) return item.date === date;
  if (!item.days?.includes(weekday(date))) return false;
  if (item.from && date < item.from) return false;
  if (item.until && date > item.until) return false;
  if (item.exceptions?.includes(date)) return false;
  return true;
}

export function addScheduleItems(inputs, { replace = false, source = "manual" } = {}) {
  if (replace) {
    removeFutureLinkedTasks(() => true);
    state.schedule = [];
  }
  const added = [];
  for (const input of inputs) {
    const item = cleanScheduleItem({ source, ...input });
    item.id = newId();
    item.createdAt = new Date().toISOString();
    state.schedule.push(item);
    added.push(item);
  }
  save();
  return added;
}

export function updateScheduleItem(id, patch) {
  const idx = state.schedule.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const item = cleanScheduleItem(patch, state.schedule[idx]);
  state.schedule[idx] = item;
  // Keep upcoming, unfinished tasks made from this item in sync.
  const t = today();
  state.tasks = state.tasks.filter((task) => {
    if (task.scheduleId !== id || task.done || task.date < t) return true;
    if (!appliesTo(item, task.date)) return task.edited; // no longer scheduled that day
    if (!task.edited) Object.assign(task, { title: item.title, start: item.start, end: item.end, notes: item.notes, priority: item.priority });
    return true;
  });
  save();
  return item;
}

function removeFutureLinkedTasks(pred) {
  const t = today();
  state.tasks = state.tasks.filter(
    (task) => !(task.scheduleId && task.date >= t && !task.done && !task.edited && pred(task)),
  );
}

export function deleteScheduleItem(id) {
  const before = state.schedule.length;
  state.schedule = state.schedule.filter((s) => s.id !== id);
  removeFutureLinkedTasks((task) => task.scheduleId === id);
  save();
  return state.schedule.length !== before;
}

export function clearSchedule() {
  removeFutureLinkedTasks(() => true);
  state.schedule = [];
  save();
}

// ---------- tasks ----------

const byTime = (a, b) => {
  if (a.start && b.start) return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
  if (a.start) return -1;
  if (b.start) return 1;
  return (a.createdAt || "").localeCompare(b.createdAt || "");
};

// Returns the tasks for a date, first creating tasks for any schedule items that
// fall on that date and haven't been pulled in yet.
export function tasksForDate(date) {
  if (!isDateStr(date)) throw new Error("Bad date");
  let changed = false;
  for (const item of state.schedule) {
    if (!appliesTo(item, date)) continue;
    const exists = state.tasks.some((t) => t.scheduleId === item.id && t.date === date);
    if (exists) continue;
    state.tasks.push({
      id: newId(),
      date,
      title: item.title,
      start: item.start,
      end: item.end,
      notes: item.notes,
      priority: item.priority,
      done: false,
      deleted: false,
      scheduleId: item.id,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  if (changed) save();
  return state.tasks.filter((t) => t.date === date && !t.deleted).sort(byTime);
}

export function addTask(input) {
  const date = normalizeDate(input.date) || today();
  const task = {
    id: newId(),
    date,
    title: String(input.title || "Untitled").trim().slice(0, 200),
    start: normalizeTime(input.start),
    end: normalizeTime(input.end),
    notes: String(input.notes || "").slice(0, 2000),
    priority: PRIORITIES.includes(input.priority) ? input.priority : "normal",
    done: false,
    deleted: false,
    scheduleId: null,
    createdAt: new Date().toISOString(),
  };
  state.tasks.push(task);
  save();
  return task;
}

export function updateTask(id, patch) {
  const task = state.tasks.find((t) => t.id === id && !t.deleted);
  if (!task) return null;
  if (patch.title !== undefined) task.title = String(patch.title).trim().slice(0, 200) || task.title;
  if (patch.start !== undefined) task.start = normalizeTime(patch.start);
  if (patch.end !== undefined) task.end = normalizeTime(patch.end);
  if (patch.notes !== undefined) task.notes = String(patch.notes || "").slice(0, 2000);
  if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) task.priority = patch.priority;
  if (patch.date !== undefined && normalizeDate(patch.date)) task.date = normalizeDate(patch.date);
  if (patch.done !== undefined) {
    task.done = Boolean(patch.done);
    task.doneAt = task.done ? new Date().toISOString() : null;
  }
  // Once a schedule-made task is edited by hand, schedule edits no longer overwrite it.
  if (task.scheduleId && ["title", "start", "end", "notes", "priority", "date"].some((k) => patch[k] !== undefined)) {
    task.edited = true;
  }
  save();
  return task;
}

export function deleteTask(id) {
  const task = state.tasks.find((t) => t.id === id && !t.deleted);
  if (!task) return false;
  if (task.scheduleId) {
    // Keep a tombstone so the schedule doesn't put it back on that day.
    task.deleted = true;
  } else {
    state.tasks = state.tasks.filter((t) => t.id !== id);
  }
  save();
  return true;
}

// Moves unfinished tasks from one day to another.
export function carryOver(from, to) {
  tasksForDate(from);
  const moved = [];
  for (const t of state.tasks) {
    if (t.date === from && !t.done && !t.deleted) {
      if (t.scheduleId) {
        // Leave the schedule's slot on `from` marked as handled, copy the task over.
        t.deleted = true;
        moved.push(addTask({ ...t, date: to, notes: t.notes }));
      } else {
        t.date = to;
        moved.push(t);
      }
    }
  }
  save();
  return moved;
}

export function updateSettings(patch) {
  if (patch.apiKey !== undefined) state.settings.apiKey = String(patch.apiKey).trim();
  if (patch.model !== undefined && String(patch.model).trim()) state.settings.model = String(patch.model).trim();
  if (patch.name !== undefined) state.settings.name = String(patch.name).trim().slice(0, 80);
  save();
  return state.settings;
}
