import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clampCalendarDate } from "../lib/calendarBounds";
import { dateKey } from "../lib/date";
import { Memory, Message, Task } from "../lib/types";
export const useTasks = create(
  persist<{
    tasks: Task[];
    add: (tasks: Task[]) => void;
    start: (id: string) => void;
    update: (id: string, patch: Partial<Task>) => void;
  }>(
    (set) => ({
      tasks: [],
      start: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id && !t.completed && !t.startedAt
              ? { ...t, startedAt: new Date().toISOString() }
              : t,
          ),
        })),
      add: (tasks) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            ...tasks.filter((t) => !s.tasks.some((x) => x.id === t.id)),
          ],
        })),
      update: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
    }),
    { name: "tempo-tasks-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
export const useCalendar = create(
  persist<{ selected: string; select: (date: string) => void }>(
    (set) => ({
      selected: dateKey(),
      select: (selected) => set({ selected: clampCalendarDate(selected) }),
    }),
    {
      name: "tempo-calendar-v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
export const useMemory = create(
  persist<{ memories: Memory[]; remember: (memory: Memory) => void }>(
    (set) => ({
      memories: [],
      remember: (memory) => set((s) => ({ memories: [...s.memories, memory] })),
    }),
    { name: "tempo-memory-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
export const useChat = create(
  persist<{
    messages: Message[];
    add: (message: Message) => void;
    status: (id: string, status: Message["status"]) => void;
  }>(
    (set) => ({
      messages: [],
      add: (message) => set((s) => ({ messages: [...s.messages, message] })),
      status: (id, status) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, status } : m)),
        })),
    }),
    { name: "tempo-chat-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
