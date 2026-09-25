import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_ENDPOINT,
  AiAction,
  enrichActionsWithLocations,
  executeAiActions,
  requestAiPlan,
} from "../lib/ai";
import { Memory, Task } from "../lib/types";

function memoryStore(initial: Task[] = []) {
  let tasks = [...initial];
  const memories: Memory[] = [];
  const scheduled: string[] = [];
  const cancelled: (string | undefined)[] = [];
  return {
    get tasks() {
      return tasks;
    },
    memories,
    scheduled,
    cancelled,
    dependencies: {
      getTasks: () => tasks,
      addTasks: (next: Task[]) => {
        tasks = [...tasks, ...next];
      },
      updateTask: (id: string, patch: Partial<Task>) => {
        tasks = tasks.map((task) =>
          task.id === id ? { ...task, ...patch } : task,
        );
      },
      removeTask: (id: string) => {
        tasks = tasks.filter((task) => task.id !== id);
      },
      remember: (memory: Memory) => memories.push(memory),
      schedule: async (task: Task) => {
        scheduled.push(task.id);
        return `notification-${task.id}`;
      },
      cancel: async (id?: string) => {
        cancelled.push(id);
      },
    },
  };
}

test("the requested dentist and gym plan keeps Seoul locations and date", async () => {
  const store = memoryStore();
  const actions: AiAction[] = [
    {
      type: "create_event",
      id: "dentist",
      title: "Dentist appointment",
      date: "2026-09-26",
      time: "11:00",
      location: "Gangnam Station",
    },
    {
      type: "create_task",
      id: "gym",
      title: "Gym",
      date: "2026-09-26",
      time: "18:00",
      location: "Jamsil",
    },
  ];

  await executeAiActions(actions, store.dependencies);

  assert.deepEqual(
    store.tasks.map(({ title, date, time, location, type }) => ({
      title,
      date,
      time,
      location,
      type,
    })),
    [
      {
        title: "Dentist appointment",
        date: "2026-09-26",
        time: "11:00",
        location: "Gangnam Station",
        type: "Event",
      },
      {
        title: "Gym",
        date: "2026-09-26",
        time: "18:00",
        location: "Jamsil",
        type: "Task",
      },
    ],
  );
  assert.deepEqual(store.scheduled, ["dentist", "gym"]);
});

test("explicit locations enrich an older deployed response", () => {
  const actions = enrichActionsWithLocations(
    "Tomorrow I have a dentist appointment at 11 at Gangnam Station and gym at 6 in Jamsil",
    [
      {
        type: "create_event",
        title: "Dentist Appointment",
        date: "2026-09-26",
        time: "11:00",
      },
      {
        type: "create_event",
        title: "Gym",
        date: "2026-09-26",
        time: "18:00",
      },
    ],
  );

  assert.equal(actions[0].location, "Gangnam Station");
  assert.equal(actions[1].location, "Jamsil");
});

test("location changes target an existing item instead of duplicating it", () => {
  const existing: Task = {
    id: "dentist-existing",
    title: "Dentist Appointment",
    date: "2026-09-26",
    time: "11:00",
    type: "Event",
    completed: false,
    reminderMinutes: 15,
  };
  const [action] = enrichActionsWithLocations(
    "Move my dentist appointment to the clinic in Gangnam",
    [
      {
        type: "create_event",
        title: "Dentist Appointment",
        date: "2026-09-26",
        time: "11:00",
      },
    ],
    [existing],
  );

  assert.equal(action.type, "update_event");
  assert.equal(action.id, "dentist-existing");
  assert.equal(action.location, "the clinic in Gangnam");
});

test("all mutation actions update the local stores", async () => {
  const store = memoryStore();
  await executeAiActions(
    [
      {
        type: "create_event",
        id: "dentist",
        title: "Dentist appointment",
        date: "2026-09-26",
        time: "11:00",
        location: "Gangnam Station",
      },
      {
        type: "create_task",
        id: "gym",
        title: "Gym",
        date: "2026-09-26",
        time: "18:00",
        location: "Jamsil",
      },
      {
        type: "update_event",
        id: "dentist",
        location: "Clinic in Gangnam",
      },
      { type: "update_task", id: "gym", time: "19:00" },
      {
        type: "create_reminder",
        id: "dentist",
        reminderMinutes: 5,
      },
      {
        type: "save_behavior_pattern",
        title: "Gym",
        reason: "I was already home",
        strategy: "Schedule the gym before going home.",
      },
      { type: "delete_task", id: "gym" },
    ],
    store.dependencies,
  );

  assert.equal(store.tasks.length, 1);
  assert.equal(store.tasks[0].location, "Clinic in Gangnam");
  assert.equal(store.tasks[0].reminderMinutes, 5);
  assert.equal(store.memories[0].subject, "Gym");
});

test("chat requests use the deployed endpoint and Seoul date context", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ reply: "Ready.", actions: [] });
  };

  try {
    const result = await requestAiPlan("Tomorrow gym at 6", [], []);
    assert.equal(result.reply, "Ready.");
    assert.equal(requestedUrl, AI_ENDPOINT);
    assert.equal(requestBody.timeZone, "Asia/Seoul");
    assert.match(String(requestBody.currentDate), /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(requestBody.tasks, []);
    assert.deepEqual(requestBody.events, []);
    assert.deepEqual(requestBody.memory, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
