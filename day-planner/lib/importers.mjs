// Turns schedule files into schedule items: iCalendar (.ics), CSV, JSON and
// plain text ("9:00-10:00 Standup", "Mon,Wed 18:00 Gym").
import {
  toDateStr, toTimeStr, today, normalizeTime, normalizeDate, normalizeDays, DAY_NAMES,
} from "./dates.mjs";

// ---------- iCalendar ----------

const ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unescapeIcs(s) {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

// Returns { date, time } in local time, or null.
function parseIcsDateTime(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined || params.VALUE === "DATE") return { date: `${y}-${mo}-${d}`, time: "" };
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    return { date: toDateStr(dt), time: toTimeStr(dt) };
  }
  // Floating or TZID time: used as the wall-clock time it states.
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function parseIcsLine(line) {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params = {};
  for (const p of paramParts) {
    const [k, v] = p.split("=");
    if (k) params[k.toUpperCase()] = (v || "").replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

export function parseIcs(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = [];
  let ev = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "BEGIN:VEVENT") { ev = { exdates: [] }; continue; }
    if (line === "END:VEVENT") { if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const p = parseIcsLine(line);
    if (!p) continue;
    switch (p.name) {
      case "SUMMARY": ev.title = unescapeIcs(p.value); break;
      case "DESCRIPTION": ev.notes = unescapeIcs(p.value); break;
      case "LOCATION": ev.location = unescapeIcs(p.value); break;
      case "UID": ev.uid = p.value; break;
      case "STATUS": ev.status = p.value.toUpperCase(); break;
      case "DTSTART": ev.start = parseIcsDateTime(p.value, p.params); break;
      case "DTEND": ev.end = parseIcsDateTime(p.value, p.params); break;
      case "RRULE": ev.rrule = Object.fromEntries(p.value.split(";").map((kv) => kv.split("="))); break;
      case "RECURRENCE-ID": ev.recurrenceId = parseIcsDateTime(p.value, p.params); break;
      case "EXDATE":
        for (const v of p.value.split(",")) {
          const d = parseIcsDateTime(v, p.params);
          if (d) ev.exdates.push(d.date);
        }
        break;
    }
  }

  const t = today();
  const items = [];
  const skipped = { past: 0, cancelled: 0, unsupported: 0 };
  const byUid = new Map();

  for (const ev of events) {
    if (!ev.start) { skipped.unsupported++; continue; }
    if (ev.status === "CANCELLED") { skipped.cancelled++; continue; }
    const notes = [ev.location ? `Location: ${ev.location}` : "", ev.notes || ""].filter(Boolean).join("\n");
    const base = {
      title: ev.title || "Untitled event",
      start: ev.start.time,
      end: ev.end && ev.end.date === ev.start.date ? ev.end.time : "",
      notes: notes.slice(0, 2000),
      uid: ev.uid || "",
    };
    const rr = ev.rrule;
    if (rr && !ev.recurrenceId && (rr.FREQ === "WEEKLY" || rr.FREQ === "DAILY")) {
      let days;
      if (rr.FREQ === "DAILY") days = [0, 1, 2, 3, 4, 5, 6];
      else if (rr.BYDAY) days = rr.BYDAY.split(",").map((d) => ICS_DAYS[d.replace(/^[+-]?\d+/, "")]).filter((d) => d !== undefined);
      else days = [new Date(ev.start.date + "T00:00").getDay()];
      let until = rr.UNTIL ? parseIcsDateTime(rr.UNTIL, {})?.date || "" : "";
      if (!until && rr.COUNT) {
        // Approximate the last occurrence from COUNT.
        const perWeek = rr.FREQ === "DAILY" ? 7 : Math.max(days.length, 1);
        const interval = Number(rr.INTERVAL || 1);
        const weeks = Math.ceil(Number(rr.COUNT) / perWeek) * interval;
        const d = new Date(ev.start.date + "T00:00");
        d.setDate(d.getDate() + weeks * 7);
        until = toDateStr(d);
      }
      if (until && until < t) { skipped.past++; continue; }
      const item = { ...base, days, from: ev.start.date, until, exceptions: ev.exdates };
      if (Number(rr.INTERVAL || 1) > 1) item.notes = `${item.notes}\n(Repeats every ${rr.INTERVAL} ${rr.FREQ === "DAILY" ? "days" : "weeks"} in your calendar; shown every ${rr.FREQ === "DAILY" ? "day" : "week"} here.)`.trim();
      items.push(item);
      if (ev.uid) byUid.set(ev.uid, item);
    } else {
      // One-off, a moved occurrence, or a monthly/yearly repeat (first date only).
      if (ev.start.date < t) { skipped.past++; continue; }
      if (rr && !ev.recurrenceId) skipped.unsupported++;
      items.push({ ...base, date: ev.start.date, _recurrenceOf: ev.recurrenceId ? ev.uid : null, _recurrenceDate: ev.recurrenceId?.date });
    }
  }
  // A moved occurrence replaces that date of its repeating event.
  for (const item of items) {
    if (item._recurrenceOf && byUid.has(item._recurrenceOf)) {
      byUid.get(item._recurrenceOf).exceptions.push(item._recurrenceDate);
    }
    delete item._recurrenceOf;
    delete item._recurrenceDate;
  }
  return { items, skipped };
}

// ---------- CSV ----------

export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const HEADER_ALIASES = {
  title: ["title", "task", "name", "event", "subject", "activity", "summary", "what"],
  date: ["date", "day date", "on", "start date"],
  start: ["start", "start time", "time", "from", "begin", "starts"],
  end: ["end", "end time", "to", "until time", "finish", "ends"],
  days: ["days", "day", "repeat", "repeats", "recurring", "weekdays", "every"],
  notes: ["notes", "note", "description", "details", "location"],
  priority: ["priority", "importance"],
};

export function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length === 0) return { items: [], skipped: {} };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx !== -1) col[key] = idx;
  }
  if (col.title === undefined) {
    throw new Error('The CSV needs a header row with a "title" (or "task") column.');
  }
  const items = [];
  for (const r of rows.slice(1)) {
    const get = (k) => (col[k] === undefined ? "" : (r[col[k]] || "").trim());
    if (!get("title")) continue;
    let date = get("date");
    let days = get("days");
    // A "day" column holding a weekday name means recurring, not a date.
    if (date && !normalizeDate(date) && normalizeDays(date).length) { days = date; date = ""; }
    // And a "day" column holding a date means a one-off.
    if (!date && days && normalizeDate(days) && /\d/.test(days)) { date = days; days = ""; }
    const item = { title: get("title"), start: get("start"), end: get("end"), notes: get("notes") };
    const pr = get("priority").toLowerCase();
    if (pr) item.priority = pr.startsWith("h") ? "high" : pr.startsWith("l") ? "low" : "normal";
    if (date) item.date = date;
    else if (days) item.days = days;
    items.push(item);
  }
  return { items, skipped: {} };
}

// ---------- JSON ----------

export function parseJson(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.schedule || data.items || data.tasks || data.events;
  if (!Array.isArray(list)) throw new Error("JSON must be a list of items, or an object with a \"schedule\" list.");
  const items = list
    .filter((x) => x && (x.title || x.task || x.name))
    .map((x) => ({
      title: x.title || x.task || x.name,
      start: x.start || x.time || "",
      end: x.end || "",
      notes: x.notes || x.description || "",
      priority: x.priority,
      ...(x.date ? { date: x.date } : {}),
      ...(x.days ? { days: x.days } : {}),
      ...(x.from ? { from: x.from } : {}),
      ...(x.until ? { until: x.until } : {}),
    }));
  return { items, skipped: {} };
}

// ---------- plain text ----------

const TIME = String.raw`\d{1,2}(?:[:.]\d{2})?\s*(?:[ap]\.?m\.?)?|noon|midnight`;
const LINE_RE = new RegExp(String.raw`^(?:(.+?)\s*[:|]\s+)?(${TIME})(?:\s*(?:-|–|—|to|until)\s*(${TIME}))?\s*[-–—:|]?\s+(.+)$`, "i");

// One item per line. Optional day prefix, a time or time range, then the title:
//   09:00-09:30 Standup
//   Mon, Wed, Fri: 7am Gym
//   2026-11-12: 14:00 Dentist
//   Call mum              (no time: an everyday task)
export function parseText(text) {
  const items = [];
  const unparsed = [];
  let section = null; // A heading like "Monday" or "2026-11-12" applies to lines below it.
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      section = parsePrefix(line.replace(/^#+\s*/, "").replace(/:$/, ""));
      continue;
    }
    const headingOnly = line.replace(/:$/, "");
    const asHeading = parsePrefix(headingOnly);
    if (asHeading && !LINE_RE.test(line)) { section = asHeading; continue; }

    const m = line.match(LINE_RE);
    if (m) {
      const prefix = m[1] ? parsePrefix(m[1]) : null;
      if (m[1] && !prefix) { unparsed.push(line); continue; }
      const when = prefix || section || {};
      items.push({ title: m[4].trim(), start: normalizeTime(m[2]), end: normalizeTime(m[3] || ""), ...when });
    } else if (line.length <= 200) {
      items.push({ title: line, ...(section || {}) });
    } else {
      unparsed.push(line);
    }
  }
  return { items, skipped: unparsed.length ? { unparsed: unparsed.length } : {} };
}

function parsePrefix(s) {
  const date = normalizeDate(s);
  if (date && /\d/.test(s)) return { date };
  const days = normalizeDays(s);
  if (days.length) return { days };
  return null;
}

export function detectFormat(filename = "", content = "") {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "ics" || /BEGIN:VCALENDAR/.test(content)) return "ics";
  if (ext === "json" || /^\s*[[{]/.test(content)) return "json";
  if (ext === "csv") return "csv";
  return "text";
}

export function parseSchedule(filename, content) {
  const format = detectFormat(filename, content);
  const parsers = { ics: parseIcs, csv: parseCsv, json: parseJson, text: parseText };
  return { format, ...parsers[format](content) };
}

export function describeItem(item) {
  const when = item.date ? item.date : (item.days || []).map((d) => DAY_NAMES[d]).join(",");
  const time = item.start ? `${item.start}${item.end ? "-" + item.end : ""}` : "anytime";
  return `${when} ${time} ${item.title}`;
}
