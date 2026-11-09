// Date helpers. Dates are local "YYYY-MM-DD" strings, times are "HH:MM" (24h).

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today() {
  return toDateStr(new Date());
}

export function isDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekday(dateStr) {
  return parseDateStr(dateStr).getDay();
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Accepts "9", "9am", "9:30", "9.30pm", "14:05", "0930", "noon", "midnight".
// Returns "HH:MM" or "" when the input is empty/unparseable.
export function normalizeTime(input) {
  if (input == null) return "";
  let s = String(input).trim().toLowerCase();
  if (!s) return "";
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ampm = m[3] ? m[3][0] : "";
  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return "";
  return `${pad(h)}:${pad(min)}`;
}

// Accepts "2026-11-10", "10/11/2026" (day first, UK style), "11/10/2026" when the
// first part can't be a day, "20261110". Returns "YYYY-MM-DD" or "".
export function normalizeDate(input) {
  if (input == null) return "";
  const s = String(input).trim();
  if (!s) return "";
  if (isDateStr(s)) return s;
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    return `${y}-${pad(month)}-${pad(day)}`;
  }
  // "12 Nov 2026", "Nov 12, 2026", "Thursday 12 November 2026"
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(s) && /\b\d{4}\b/.test(s)) {
    const d = new Date(s.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s*/i, "").replace(/(\d)(st|nd|rd|th)\b/, "$1"));
    if (!Number.isNaN(d.getTime())) return toDateStr(d);
  }
  return "";
}

const DAY_ALIASES = {
  su: 0, sun: 0, sunday: 0,
  mo: 1, mon: 1, monday: 1,
  tu: 2, tue: 2, tues: 2, tuesday: 2,
  we: 3, wed: 3, weds: 3, wednesday: 3,
  th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fr: 5, fri: 5, friday: 5,
  sa: 6, sat: 6, saturday: 6,
};

// Accepts arrays of numbers/names, or strings like "Mon,Wed,Fri", "Mon-Fri",
// "weekdays", "weekends", "daily", "every day". Returns sorted unique day numbers.
export function normalizeDays(input) {
  if (input == null || input === "") return [];
  if (Array.isArray(input)) {
    const out = new Set();
    for (const v of input) {
      if (typeof v === "number" && v >= 0 && v <= 6) out.add(v);
      else for (const d of normalizeDays(String(v))) out.add(d);
    }
    return [...out].sort((a, b) => a - b);
  }
  const s = String(input).trim().toLowerCase();
  if (!s) return [];
  if (/^(daily|every ?day|all|everyday)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^(weekdays?|mon(day)?\s*-\s*fri(day)?)$/.test(s)) return [1, 2, 3, 4, 5];
  if (/^weekends?$/.test(s)) return [0, 6];
  const out = new Set();
  for (const part of s.split(/[,;/&\s]+|\band\b/).filter(Boolean)) {
    const range = part.match(/^([a-z]+)-([a-z]+)$/);
    if (range && range[1] in DAY_ALIASES && range[2] in DAY_ALIASES) {
      let d = DAY_ALIASES[range[1]];
      const end = DAY_ALIASES[range[2]];
      for (let i = 0; i < 7; i++) {
        out.add(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
    } else if (part in DAY_ALIASES) {
      out.add(DAY_ALIASES[part]);
    } else if (/^[0-6]$/.test(part)) {
      out.add(Number(part));
    }
  }
  return [...out].sort((a, b) => a - b);
}
