import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { TaskItem } from "./TaskItem";
import { useCalendar, useTasks } from "../stores";

import { Task } from "../lib/types";
export function TaskList({ onTask }: { onTask: (task: Task) => void }) {
  const selected = useCalendar((s) => s.selected);
  const all = useTasks((s) => s.tasks);
  const tasks = all
    .filter((t) => t.date === selected)
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.date}>Today's Task</Text>
      </View>
      <Animated.View key={selected} entering={FadeIn.duration(200)}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onPress={() => onTask(task)} />
        ))}
        {!tasks.length && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your day, unwritten.</Text>
            <Text style={styles.emptyText}>
              A plan, a thought, something to remember. Tell tempo what’s on
              your mind.
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 28,
    paddingTop: 27,
    borderTopWidth: 1,
    borderTopColor: "#efefef",
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  eyebrow: { fontSize: 9, color: "#999", letterSpacing: 2, fontWeight: "600" },
  date: { fontSize: 23, fontWeight: "500", letterSpacing: -0.7 },
  empty: { paddingTop: 45, paddingBottom: 30 },
  emptyTitle: { fontSize: 19, letterSpacing: -0.5, color: "#666" },
  emptyText: { fontSize: 13, lineHeight: 23, color: "#aaa", marginTop: 10 },
});
