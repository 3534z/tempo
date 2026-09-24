import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskPlan } from "../lib/taskPlan";
import { Task } from "../lib/types";
const task: Task = {
  id: "test",
  title: "Dentist",
  date: "2026-09-25",
  time: "00:15",
  type: "Event",
  completed: false,
  reminderMinutes: 15,
};
test("preparation correctly crosses into the previous calendar day", () => {
  const { steps } = buildTaskPlan(task, []);
  assert.equal(steps[0].date, "2026-09-24");
  assert.equal(steps[0].time, "11:35 PM");
  assert.equal(steps[3].date, task.date);
  assert.equal(steps[3].time, "12:15 AM");
});
test("habit text only claims remembered behavior when a matching memory exists", () => {
  assert.equal(buildTaskPlan(task, []).habit.remembered, false);
  const plan = buildTaskPlan({ ...task, title: "Gym" }, [
    {
      id: "memory",
      subject: "gym",
      reason: "I got home",
      strategy: "Plan gym before heading home.",
      createdAt: "2026-09-24",
    },
  ]);
  assert.equal(plan.habit.remembered, true);
  assert.equal(plan.habit.text, "Plan gym before heading home.");
});
test("deadline plan ends at the deadline and preserves stable step IDs", () => {
  const deadline = { ...task, title: "Finish my project", note: "Deadline." };
  const plan = buildTaskPlan(deadline, []);
  assert.equal(plan.steps.at(-1)?.id, "finish");
  assert.equal(plan.steps.at(-1)?.time, "12:15 AM");
  assert.deepEqual(
    plan.steps.map((s) => s.id),
    buildTaskPlan({ ...deadline, completedSteps: ["prepare"] }, []).steps.map(
      (s) => s.id,
    ),
  );
});
