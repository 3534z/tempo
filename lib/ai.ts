import { Platform } from "react-native";
import { Memory, Task, uid } from "./types";

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
  reminderMinutes?: number;
  reason?: string;
  strategy?: string;
};
export type AiPlan = { reply: string; actions: AiAction[] };

function endpoint() {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (Platform.OS === "web") return `${base ?? ""}/api/ai`;
  if (!base) {
    throw new Error(
      "Set EXPO_PUBLIC_API_URL to the deployed Vercel URL for mobile AI requests.",
    );
  }
  return `${base}/api/ai`;
}

export async function requestAiPlan(
  message: string,
  tasks: Task[],
  memory: Memory[],
): Promise<AiPlan> {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      tasks: tasks.filter((task) => task.type === "Task"),
      events: tasks.filter((task) => task.type === "Event"),
      memory,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  const payload = (await response.json()) as AiPlan & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Tempo could not create a plan.");
  }
  if (typeof payload.reply !== "string" || !Array.isArray(payload.actions)) {
    throw new Error("Tempo returned an invalid plan.");
  }
  return payload;
}

export function createActionsToTasks(actions: AiAction[]): Task[] {
  const reminders = actions.filter(
    (action) => action.type === "create_reminder",
  );
  return actions
    .filter(
      (action) =>
        action.type === "create_task" || action.type === "create_event",
    )
    .filter(
      (action) =>
        !!action.title &&
        /^\d{4}-\d{2}-\d{2}$/.test(action.date ?? "") &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(action.time ?? ""),
    )
    .map((action) => {
      const reminder = reminders.find(
        (candidate) =>
          candidate.title?.toLowerCase() === action.title?.toLowerCase() &&
          candidate.date === action.date,
      );
      return {
        id: uid(),
        title: action.title!,
        date: action.date!,
        time: action.time!,
        type: action.type === "create_event" ? "Event" : "Task",
        completed: false,
        reminderMinutes: Math.max(
          0,
          Math.min(1440, reminder?.reminderMinutes ?? action.reminderMinutes ?? 15),
        ),
        suggested: false,
      };
    });
}
