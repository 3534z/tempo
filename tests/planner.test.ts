import { test } from "node:test";
import assert from "node:assert/strict";
import { planLocally, captureMemory } from "../lib/planner";
import { offsetDate } from "../lib/date";
const now = new Date(2026, 8, 24, 12);
test("requested demonstration creates four plans with fixed times and a deadline", () => {
  const { tasks } = planLocally(
    "Tomorrow I need to go to the dentist at 11, go to the gym, buy shampoo and finish my project before 8 PM",
    [],
    "2026-09-24",
    now,
  );
  assert.equal(tasks.length, 4);
  assert.equal(tasks[0].date, "2026-09-25");
  assert.equal(tasks[0].time, "11:00");
  assert.equal(tasks[0].type, "Event");
  assert.equal(tasks[3].time, "20:00");
  assert.match(tasks[3].note!, /Deadline/);
  assert.equal(tasks[1].suggested, true);
});
test("missed-task feedback changes future suggestions without overriding explicit times", () => {
  const memory = captureMemory(
    "I missed the gym because I already got home and did not want to leave again",
  );
  assert.ok(memory);
  assert.equal(memory.subject, "gym");
  const result = planLocally(
    "Tomorrow go to the gym",
    [memory],
    "2026-09-24",
    now,
  );
  assert.match(result.text, /before heading home/);
  assert.equal(result.tasks[0].reminderMinutes, 30);
  assert.equal(
    planLocally("gym at 8 PM", [memory], "2026-09-24", now).tasks[0].time,
    "20:00",
  );
});
test("local day arithmetic crosses month boundaries", () =>
  assert.equal(offsetDate(1, new Date(2026, 11, 31, 23)), "2027-01-01"));
test("unsupported chat never creates an invented task", () =>
  assert.equal(planLocally("hello there", []).tasks.length, 0));
test("invalid clock times never become scheduled tasks", () =>
  assert.equal(planLocally("dentist at 29:95", []).tasks.length, 0));
test("morning and noon parsing", () => {
  assert.equal(planLocally("call mum at 12 AM", []).tasks[0].time, "00:00");
  assert.equal(planLocally("lunch at 12 PM", []).tasks[0].time, "12:00");
});
