import { dateKey, timeLabel } from "./date";
import { Memory, Task } from "./types";

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  time: string;
  date: string;
};
export type TaskPlan = {
  steps: PlanStep[];
  habit: { title: string; text: string; remembered: boolean };
};

/** Local plan adapter. A future AI provider can return this same shape. */
export function buildTaskPlan(task: Task, memories: Memory[]): TaskPlan {
  const title = task.title.toLowerCase();
  const memory = [...memories]
    .reverse()
    .find((m) => title.includes(m.subject.toLowerCase()));
  const outside = /dentist|appointment|gym|meet|coffee|lunch|dinner|visit/.test(
    title,
  );
  const shopping = /buy|shop|pick up/.test(title);
  const deadline = /deadline/i.test(task.note || "");
  const definitions: Array<[string, number, string, string]> = outside
    ? [
        [
          "prepare",
          -40,
          "Start preparing",
          /gym/.test(title)
            ? "Pack your kit and fill your water bottle."
            : "Gather what you need before you leave.",
        ],
        [
          "leave",
          -25,
          "Leave with a little room",
          "Allow 25 minutes for travel. Adjust for your journey.",
        ],
        [
          "arrive",
          -5,
          "Take a moment to settle in",
          "A little breathing room before you begin.",
        ],
        ["begin", 0, task.title, "Your planned start time."],
      ]
    : shopping
      ? [
          [
            "prepare",
            -15,
            "Make a short list",
            "Check what you already have and what you need.",
          ],
          ["begin", 0, task.title, "Keep the essentials in mind."],
          [
            "finish",
            20,
            "Put everything in its place",
            "A small reset before the next part of your day.",
          ],
        ]
      : deadline
        ? [
            [
              "prepare",
              -70,
              "Clear a little space",
              "Open what you need and remove distractions.",
            ],
            [
              "focus",
              -60,
              "Give it your attention",
              "One quiet hour for the most important part.",
            ],
            [
              "review",
              -10,
              "Review the final details",
              "Save your work and check what is left.",
            ],
            ["finish", 0, task.title, "Your planned deadline."],
          ]
        : [
            [
              "prepare",
              -10,
              "Make room to begin",
              "Have what you need close at hand.",
            ],
            ["begin", 0, task.title, "Focus on one thing at a time."],
            [
              "finish",
              30,
              "Bring it to a close",
              "Leave a small note about where you finished.",
            ],
          ];
  const steps = definitions.map(([id, offset, title, detail]) => {
    const date = new Date(`${task.date}T${task.time}:00`);
    date.setMinutes(date.getMinutes() + offset);
    return {
      id,
      title,
      detail,
      time: timeLabel(
        `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`,
      ),
      date: dateKey(date),
    };
  });
  return {
    steps,
    habit: memory
      ? {
          title: "A pattern to remember",
          text: memory.strategy,
          remembered: true,
        }
      : {
          title: "A small suggestion",
          text: /gym/.test(title)
            ? "Keep your gym bag ready before the day begins. One less decision when it is time to go."
            : deadline
              ? "A short, uninterrupted stretch is easier to start when everything you need is already open."
              : "Prepare the small things beforehand, so starting feels a little easier.",
          remembered: false,
        },
  };
}
