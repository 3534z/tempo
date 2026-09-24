import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { Message } from "../lib/types";
import { dayLabel, timeLabel } from "../lib/date";
export function ChatMessage({
  message,
  onConfirm,
  busy,
}: {
  message: Message;
  onConfirm: (message: Message) => void;
  busy: boolean;
}) {
  const user = message.role === "user";
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.message, user && styles.user]}
    >
      {!user && <Text style={styles.name}>TEMPO</Text>}
      {message.audio && <VoiceMessagePlayer audio={message.audio} />}
      {!!message.text && (
        <Text selectable style={styles.text}>
          {message.text}
        </Text>
      )}
      {message.plan && (
        <View style={styles.plan}>
          {message.plan.map((task) => (
            <View key={task.id} style={styles.planRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.meta}>
                  {dayLabel(task.date)} · {task.type}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontSize: 12 }}>{timeLabel(task.time)}</Text>
                <Text style={styles.meta}>
                  {task.suggested ? "Suggested" : "Fixed time"}
                </Text>
              </View>
            </View>
          ))}
          {message.status === "pending" ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onConfirm(message)}
              style={[styles.confirm, busy && { opacity: 0.4 }]}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "500" }}>
                {busy ? "Saving…" : "Looks good, add to my day"}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.saved}>
              {message.status === "saved"
                ? "Added to your calendar"
                : "Replaced by your latest plan"}
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  message: { marginBottom: 29 },
  user: {
    backgroundColor: "#f3f3f3",
    padding: 17,
    borderRadius: 19,
    borderBottomRightRadius: 5,
    alignSelf: "flex-end",
    maxWidth: "91%",
  },
  name: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#999",
    marginBottom: 12,
  },
  text: { fontSize: 15, lineHeight: 25, color: "#333" },
  plan: { marginTop: 15 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  taskTitle: { fontSize: 14, fontWeight: "500" },
  meta: { fontSize: 10, color: "#999" },
  confirm: {
    marginTop: 19,
    backgroundColor: "#181818",
    padding: 17,
    borderRadius: 15,
    alignItems: "center",
  },
  saved: { fontSize: 12, color: "#888", marginTop: 18 },
});
