export type Task = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "Event" | "Task";
  completed: boolean;
  startedAt?: string;
  completedSteps?: string[];
  note?: string;
  reminderMinutes: number;
  notificationId?: string;
  suggested?: boolean;
};
export type Memory = {
  id: string;
  subject: string;
  reason: string;
  strategy: string;
  createdAt: string;
};
export type VoiceMessage = { id: string; duration: number };
export type Message = {
  audio?: VoiceMessage;
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: Task[];
  status?: "pending" | "saved" | "dismissed";
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
