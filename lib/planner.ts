import { dateKey, offsetDate } from "./date";
import { Memory, Task, uid } from "./types";
export function captureMemory(input: string): Memory | null {
  const match = input.match(
    /(?:missed|skipped|didn't (?:do|finish|go to)|did not (?:do|finish|go to))\s+(.*?)\s+because\s+(.+)/i,
  );
  if (!match) return null;
  const subject = match[1].replace(/^(the|my)\s+/i, "").trim();
  const reason = match[2].trim();
  const strategy = /home|leave again/i.test(reason)
    ? `Plan ${subject} before heading home.`
    : /tired|energy|exhaust/i.test(reason)
      ? `Plan ${subject} earlier, while your energy is fresh.`
      : /forgot|remember/i.test(reason)
        ? `Give ${subject} an earlier reminder.`
        : /time|busy|long/i.test(reason)
          ? `Leave a little more breathing room for ${subject}.`
          : `Keep your previous obstacle in mind: ${reason}`;
  return {
    id: uid(),
    subject,
    reason,
    strategy,
    createdAt: new Date().toISOString(),
  };
}
export function planLocally(
  input: string,
  memories: Memory[],
  selectedDate = dateKey(),
  now = new Date(),
): { tasks: Task[]; text: string } {
  let date = /tomorrow/i.test(input)
    ? offsetDate(1, now)
    : /today/i.test(input)
      ? dateKey(now)
      : selectedDate;
  const weekday = input.match(
    /\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekday) {
    const target = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(weekday[1].toLowerCase());
    date = offsetDate((target - now.getDay() + 7) % 7 || 7, now);
  }
  const clean = input
    .replace(
      /\b(?:tomorrow|today|next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b|\b(tomorrow|today)\b/gi,
      "",
    )
    .replace(
      /\b(?:I need to|I want to|I have to|please|can you|schedule|remind me to)\b/gi,
      "",
    )
    .trim();
  const chunks = clean
    .split(/,|;|\band\b|\bthen\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const used: Memory[] = [];
  const tasks = chunks
    .filter((s) =>
      /\b(go|buy|finish|call|meet|dentist|gym|project|work|read|walk|run|pick|appointment|lunch|dinner|coffee|study|write|pay|send|clean|book|visit|review|team|design)\b/i.test(
        s,
      ),
    )
    .map((chunk, i): Task => {
      const time = chunk.match(
        /\b(at|before|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      );
      let hours = time
        ? Number(time[2])
        : /gym/i.test(chunk)
          ? 17
          : /buy|pick/i.test(chunk)
            ? 18
            : 9 + i;
      const mins = time?.[3] ? Number(time[3]) : 0;
      if (time?.[4])
        hours = (hours % 12) + (time[4].toLowerCase() === "pm" ? 12 : 0);
      if (hours > 23 || mins > 59) return null as unknown as Task;
      let title = chunk
        .replace(/\b(at|before|by)\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, "")
        .replace(/^(to\s+)?go to (the )?/i, "")
        .replace(/^I\s+/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      const memory = [...memories]
        .reverse()
        .find(
          (m) =>
            title.toLowerCase().includes(m.subject.toLowerCase()) ||
            m.subject.toLowerCase().includes(title.toLowerCase()),
        );
      if (memory) {
        used.push(memory);
        if (!time && /home/i.test(memory.reason)) hours = 17;
        else if (!time && /tired|energy|exhaust/i.test(memory.reason))
          hours = 9;
      }
      return {
        id: uid(),
        title,
        date,
        time: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
        type: /dentist|appointment|meet|lunch|dinner|coffee/i.test(title)
          ? "Event"
          : "Task",
        completed: false,
        reminderMinutes: memory ? 30 : 15,
        suggested: !time,
        note: [
          time?.[1] === "before" || time?.[1] === "by"
            ? "Deadline. Reminder gives you time to wrap up."
            : "",
          memory?.strategy ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    })
    .filter(Boolean);
  return {
    tasks,
    text: tasks.length
      ? `Here’s a little structure for your day. ${tasks.some((t) => t.suggested) ? "I suggested times for the open-ended plans. " : ""}${used.length ? `I remember: ${used[0].strategy} ` : ""}Reminders are set ${used.length ? "15–30" : "15"} minutes beforehand. How does this look?`
      : "Tell me what you have planned and when. Try “Tomorrow, dentist at 11, go to the gym and finish my project before 8 PM.”",
  };
}
