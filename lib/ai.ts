import { Memory, Task, uid } from "./types";

export const AI_ENDPOINT = "https://tempo-3534z.vercel.app/api/ai";
export const PLANNING_TIME_ZONE = "Asia/Seoul";

export type AiAction = {
  type:
    | "create_task"
    | "update_task"
    | "delete_task"
    | "create_event"
    | "update_event"
    | "create_reminder"
    | "save_behavior_pattern";
  id?: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  address?: string;
  reminderMinutes?: number;
  reason?: string;
  strategy?: string;
};
export type AiPlan = { reply: string; actions: AiAction[] };

export type ActionDependencies = {
  getTasks: () => Task[];
  addTasks: (tasks: Task[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  remember: (memory: Memory) => void;
  schedule: (task: Task) => Promise<string | undefined>;
  cancel: (notificationId?: string) => Promise<void>;
};

function explicitLocation(text: string) {
  const moved = text.match(
    /\b(?:location\s+)?to\s+(.+?)(?=\s+(?:and|then)\b|$)/i,
  );
  if (moved) return moved[1].trim().replace(/[.,]+$/, "");

  const nearOrIn = [...text.matchAll(/\b(?:near|in)\s+(.+?)(?=\s+(?:and|then)\b|$)/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (nearOrIn.length) return nearOrIn.at(-1)?.replace(/[.,]+$/, "");

  const at = [...text.matchAll(/\bat\s+(.+?)(?=\s+at\s+|\s+(?:and|then)\b|$)/gi)]
    .map((match) => match[1].trim())
    .filter(
      (value) =>
        !/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(value),
    );
  if (at.length) return at.at(-1)?.replace(/[.,]+$/, "");

  return undefined;
}

export function enrichActionsWithLocations(
  message: string,
  actions: AiAction[],
  tasks: Task[] = [],
) {
  const clauses = message.split(
    /\s+\band\b\s+|\s*,\s*(?=(?:go|gym|dentist|buy|finish|call|meet|visit)\b)/i,
  );
  const locationChange = /\b(?:move|change|update)\b/i.test(message);
  return actions.map((action) => {
    if (!action.title) return action;
    const words = action.title
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length >= 4);
    const clause =
      clauses.find((candidate) =>
        words.some((word) => candidate.toLowerCase().includes(word)),
      ) ?? message;
    const location =
      action.location || action.address ? undefined : explicitLocation(clause);
    let enriched = location ? { ...action, location } : action;

    if (locationChange) {
      const target = tasks.find((task) => {
        const taskTitle = task.title.toLowerCase();
        return (
          words.some((word) => taskTitle.includes(word)) ||
          taskTitle
            .split(/\W+/)
            .filter((word) => word.length >= 4)
            .some((word) => message.toLowerCase().includes(word))
        );
      });
      if (target) {
        enriched = {
          ...enriched,
          id: target.id,
          type:
            enriched.type === "create_event"
              ? "update_event"
              : enriched.type === "create_task"
                ? "update_task"
                : enriched.type,
        };
      }
    }
    return enriched;
  });
}

function dateInTimeZone(date = new Date(), timeZone = PLANNING_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function requestAiPlan(
  message: string,
  tasks: Task[],
  memory: Memory[],
): Promise<AiPlan> {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      tasks: tasks.filter((task) => task.type === "Task"),
      events: tasks.filter((task) => task.type === "Event"),
      memory,
      currentDate: dateInTimeZone(),
      timeZone: PLANNING_TIME_ZONE,
    }),
  });
  let payload: (AiPlan & { error?: string }) | undefined;
  try {
    payload = (await response.json()) as AiPlan & { error?: string };
  } catch {
    throw new Error("Tempo returned an unreadable response. Please try again.");
  }
  if (!response.ok) {
    throw new Error(payload.error || "Tempo could not create a plan.");
  }
  if (typeof payload.reply !== "string" || !Array.isArray(payload.actions)) {
    throw new Error("Tempo returned an invalid plan.");
  }
  return {
    ...payload,
    actions: enrichActionsWithLocations(message, payload.actions, tasks),
  };
}

function validDate(value?: string) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value?: string) {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function createActionsToTasks(actions: AiAction[]): Task[] {
  return actions
    .filter(
      (action) =>
        action.type === "create_task" || action.type === "create_event",
    )
    .filter(
      (action) =>
        !!action.title && validDate(action.date) && validTime(action.time),
    )
    .map((action) => ({
      id: action.id || uid(),
      title: action.title!.trim(),
      date: action.date!,
      time: action.time!,
      location: action.location?.trim() || undefined,
      address: action.address?.trim() || undefined,
      type: action.type === "create_event" ? "Event" : "Task",
      completed: false,
      reminderMinutes: Math.max(
        0,
        Math.min(1440, action.reminderMinutes ?? 15),
      ),
      suggested: false,
    }));
}

function findTarget(tasks: Task[], action: AiAction, type?: Task["type"]) {
  if (action.id) {
    const exact = tasks.find((task) => task.id === action.id);
    if (exact && (!type || exact.type === type)) return exact;
  }
  const title = action.title?.trim().toLowerCase();
  if (!title) return undefined;
  const candidates = tasks.filter((task) => !type || task.type === type);
  return (
    candidates.find((task) => task.title.toLowerCase() === title) ??
    candidates.find(
      (task) =>
        task.title.toLowerCase().includes(title) ||
        title.includes(task.title.toLowerCase()),
    )
  );
}

function updatePatch(action: AiAction): Partial<Task> {
  const patch: Partial<Task> = {};
  if (action.title?.trim()) patch.title = action.title.trim();
  if (validDate(action.date)) patch.date = action.date;
  if (validTime(action.time)) patch.time = action.time;
  const hasLocation = Object.prototype.hasOwnProperty.call(action, "location");
  const hasAddress = Object.prototype.hasOwnProperty.call(action, "address");
  if (hasLocation) {
    patch.location = action.location?.trim() || undefined;
    if (!hasAddress) patch.address = undefined;
  }
  if (hasAddress) {
    patch.address = action.address?.trim() || undefined;
    if (!hasLocation) patch.location = undefined;
  }
  if (typeof action.reminderMinutes === "number") {
    patch.reminderMinutes = Math.max(
      0,
      Math.min(1440, action.reminderMinutes),
    );
  }
  return patch;
}

export async function executeAiActions(
  actions: AiAction[],
  dependencies: ActionDependencies,
) {
  const created = createActionsToTasks(actions);
  if (created.length) dependencies.addTasks(created);

  const changed = new Set(created.map((task) => task.id));
  for (const action of actions) {
    if (action.type === "update_task" || action.type === "update_event") {
      const target = findTarget(
        dependencies.getTasks(),
        action,
        action.type === "update_event" ? "Event" : "Task",
      );
      if (!target) continue;
      dependencies.updateTask(target.id, updatePatch(action));
      changed.add(target.id);
    }

    if (action.type === "delete_task") {
      const target = findTarget(dependencies.getTasks(), action);
      if (!target) continue;
      await dependencies.cancel(target.notificationId);
      dependencies.removeTask(target.id);
      changed.delete(target.id);
    }

    if (action.type === "create_reminder") {
      const target = findTarget(dependencies.getTasks(), action);
      if (!target) continue;
      if (typeof action.reminderMinutes === "number") {
        dependencies.updateTask(target.id, {
          reminderMinutes: Math.max(
            0,
            Math.min(1440, action.reminderMinutes),
          ),
        });
      }
      changed.add(target.id);
    }

    if (
      action.type === "save_behavior_pattern" &&
      action.title &&
      action.reason &&
      action.strategy
    ) {
      dependencies.remember({
        id: uid(),
        subject: action.title,
        reason: action.reason,
        strategy: action.strategy,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const id of changed) {
    const task = dependencies.getTasks().find((candidate) => candidate.id === id);
    if (!task) continue;
    await dependencies.cancel(task.notificationId);
    const notificationId = await dependencies.schedule(task);
    dependencies.updateTask(task.id, { notificationId });
  }

  return created;
}
