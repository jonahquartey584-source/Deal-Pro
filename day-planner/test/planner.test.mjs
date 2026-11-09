import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PLANNER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "planner-test-"));
const { parseIcs, parseCsv, parseText, parseJson } = await import("../lib/importers.mjs");
const store = await import("../lib/store.mjs");
const { normalizeTime, normalizeDays, normalizeDate, addDays, today, weekday } = await import("../lib/dates.mjs");

test("times, days and dates normalise", () => {
  assert.equal(normalizeTime("9am"), "09:00");
  assert.equal(normalizeTime("2:30 pm"), "14:30");
  assert.equal(normalizeTime("12am"), "00:00");
  assert.equal(normalizeTime("17:05"), "17:05");
  assert.equal(normalizeTime("nonsense"), "");
  assert.deepEqual(normalizeDays("Mon-Fri"), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeDays("Mon, Wed, Fri"), [1, 3, 5]);
  assert.deepEqual(normalizeDays("weekends"), [0, 6]);
  assert.deepEqual(normalizeDays("Fri-Mon"), [0, 1, 5, 6]);
  assert.equal(normalizeDate("14/11/2026"), "2026-11-14");
  assert.equal(normalizeDate("12 Nov 2026"), "2026-11-12");
  assert.equal(normalizeDate("Gym 2"), "");
});

test("ics: weekly repeat, one-off, past and cancelled", () => {
  const future = addDays(today(), 3).replace(/-/g, "");
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:a1
SUMMARY:Standup
DTSTART;TZID=Europe/London:20260105T091500
DTEND;TZID=Europe/London:20260105T093000
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
EXDATE;TZID=Europe/London:20261225T091500
END:VEVENT
BEGIN:VEVENT
UID:b2
SUMMARY:Dentist\\, checkup
DTSTART:${future}T140000
DTEND:${future}T143000
LOCATION:High St
END:VEVENT
BEGIN:VEVENT
UID:c3
SUMMARY:Old thing
DTSTART:20200101T100000
END:VEVENT
BEGIN:VEVENT
UID:d4
SUMMARY:Cancelled
STATUS:CANCELLED
DTSTART:${future}T100000
END:VEVENT
END:VCALENDAR`;
  const { items, skipped } = parseIcs(ics);
  assert.equal(items.length, 2);
  const standup = items.find((i) => i.title === "Standup");
  assert.deepEqual(standup.days, [1, 2, 3, 4, 5]);
  assert.equal(standup.start, "09:15");
  assert.equal(standup.end, "09:30");
  assert.deepEqual(standup.exceptions, ["2026-12-25"]);
  const dentist = items.find((i) => i.title === "Dentist, checkup");
  assert.equal(dentist.start, "14:00");
  assert.match(dentist.notes, /High St/);
  assert.equal(skipped.past, 1);
  assert.equal(skipped.cancelled, 1);
});

test("csv with quoted fields and a weekday in the day column", () => {
  const csv = 'Task,Day,Start,End,Notes\nGym,"Mon,Wed",6pm,7pm,"Leg day, then stretch"\nDentist,2026-11-20,14:00,,\n';
  const { items } = parseCsv(csv);
  assert.equal(items.length, 2);
  assert.equal(items[0].days, "Mon,Wed");
  assert.equal(items[0].notes, "Leg day, then stretch");
  assert.equal(items[1].date, "2026-11-20");
});

test("plain text lines and day headings", () => {
  const { items } = parseText(fs.readFileSync(new URL("../examples/schedule.txt", import.meta.url), "utf8"));
  const titles = items.map((i) => i.title);
  assert.deepEqual(titles, ["Standup", "Gym", "Read for 20 minutes", "Food shop", "Football", "Call with accountant"]);
  assert.deepEqual(normalizeDays(items[0].days), [1, 2, 3, 4, 5]);
  assert.equal(items[1].start, "07:00");
  assert.deepEqual(items[3].days, [6]);
  assert.equal(items[4].end, "16:00");
  assert.equal(items[5].date, "2026-11-18");
});

test("json list", () => {
  const { items } = parseJson('{"schedule":[{"title":"A","days":"weekdays","start":"9:00"},{"task":"B","date":"2026-12-01"}]}');
  assert.equal(items.length, 2);
  assert.equal(items[1].title, "B");
});

test("schedule items become tasks on matching days, once", () => {
  store.load();
  const t = today();
  const wd = weekday(t);
  const [routine, oneOff, otherDay] = store.addScheduleItems([
    { title: "Routine", days: [wd], start: "9am" },
    { title: "One-off", date: t, start: "14:00" },
    { title: "Other day", days: [(wd + 1) % 7] },
  ]);
  let tasks = store.tasksForDate(t);
  assert.deepEqual(tasks.map((x) => x.title), ["Routine", "One-off"]);
  tasks = store.tasksForDate(t);
  assert.equal(tasks.length, 2, "not duplicated on reload");

  // Deleting a schedule-made task keeps it gone for that day.
  store.deleteTask(tasks[0].id);
  assert.deepEqual(store.tasksForDate(t).map((x) => x.title), ["One-off"]);

  // Editing the schedule updates unfinished upcoming tasks.
  store.updateScheduleItem(oneOff.id, { title: "One-off (moved)", start: "15:00" });
  assert.equal(store.tasksForDate(t)[0].title, "One-off (moved)");

  // Removing an item from the schedule removes its unfinished tasks.
  store.deleteScheduleItem(oneOff.id);
  assert.equal(store.tasksForDate(t).length, 0);
  assert.ok(otherDay && routine);
});

test("carry over moves unfinished tasks", () => {
  const t = today();
  const y = addDays(t, -1);
  store.addTask({ date: y, title: "Unfinished" });
  const done = store.addTask({ date: y, title: "Finished" });
  store.updateTask(done.id, { done: true });
  const before = store.tasksForDate(t).length;
  store.carryOver(y, t);
  const after = store.tasksForDate(t);
  assert.equal(after.length, before + 1);
  assert.ok(after.some((x) => x.title === "Unfinished"));
});
