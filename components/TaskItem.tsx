import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Task } from "../lib/types";
import { timeLabel } from "../lib/date";
export function TaskItem({
  task,
  onPress,
}: {
  task: Task;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      layout={LinearTransition.duration(200)}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${timeLabel(task.time)}, ${task.completed ? "completed" : "incomplete"}`}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
      >
        <View style={{ flex: 1, gap: 7 }}>
          <Text style={[styles.title, task.completed && styles.completed]}>
            {task.title}
          </Text>
          <Text style={styles.type}>
            {task.type}
            {task.note?.includes("Deadline") ? " · Deadline" : ""}
          </Text>
        </View>
        <Text style={[styles.time, task.completed && { color: "#b2b2b2" }]}>
          {timeLabel(task.time)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    minHeight: 85,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eaeaea",
  },
  title: { fontSize: 16, fontWeight: "500", letterSpacing: -0.25 },
  completed: { color: "#aaa", textDecorationLine: "line-through" },
  type: { fontSize: 11, color: "#939393", letterSpacing: 0.2 },
  time: { fontSize: 12, color: "#666", fontVariant: ["tabular-nums"] },
});
