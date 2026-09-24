import { Platform } from "react-native";
import { Task } from "./types";
export async function scheduleReminder(
  task: Task,
): Promise<string | undefined> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("plans", {
        name: "Plans",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150],
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const date = new Date(`${task.date}T${task.time}:00`);
    date.setMinutes(date.getMinutes() - task.reminderMinutes);
    if (date.getTime() <= Date.now()) return;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body:
          task.note ||
          `Your ${task.type.toLowerCase()} starts in ${task.reminderMinutes} minutes.`,
        data: { taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: "plans",
      },
    });
  } catch {
    return;
  }
}
export async function cancelReminder(id?: string) {
  if (id && Platform.OS !== "web") {
    try {
      await (
        await import("expo-notifications")
      ).cancelScheduledNotificationAsync(id);
    } catch {}
  }
}
