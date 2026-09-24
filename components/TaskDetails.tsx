import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "./BackButton";
import { GradientFill } from "./GradientFill";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Task } from "../lib/types";
import { dayLabel, timeLabel } from "../lib/date";
import { buildTaskPlan } from "../lib/taskPlan";
import { useTasks, useMemory } from "../stores";
import { cancelReminder, scheduleReminder } from "../lib/notifications";
import { tap } from "../lib/haptics";
import { LogoMenu } from "./LogoMenu";

export function TaskDetails({
  task,
  onClose,
  onFeedback,
}: {
  task: Task | null;
  onClose: () => void;
  onFeedback: (text: string) => void;
}) {
  const current = useTasks((s) => s.tasks.find((t) => t.id === task?.id));
  const update = useTasks((s) => s.update);
  const memories = useMemory((s) => s.memories);
  const [saving, setSaving] = useState(false);
  const [reminderHint, setReminderHint] = useState("");
  useEffect(() => setReminderHint(""), [task?.id]);
  const active = current || task;
  if (!active) return null;
  const plan = buildTaskPlan(active, memories);
  const completed = active.completedSteps || [];
  const next = active.completed
    ? undefined
    : plan.steps.find((s) => !completed.includes(s.id));
  const startTask = async () => {
    if (saving || active.completed || active.startedAt) return;
    tap();
    setSaving(true);
    setReminderHint("");
    useTasks.getState().start(active.id);
    update(active.id, { notificationId: undefined });
    try {
      await cancelReminder(active.notificationId);
    } finally {
      setSaving(false);
    }
  };
  const remind = async () => {
    if (saving || active.completed || active.startedAt) return;
    tap();
    setSaving(true);
    setReminderHint("");
    try {
      await cancelReminder(active.notificationId);
      update(active.id, { reminderMinutes: 5, notificationId: undefined });
      const id = await scheduleReminder({ ...active, reminderMinutes: 5 });
      update(active.id, { notificationId: id });
      const date =
        new Date(`${active.date}T${active.time}:00`).getTime() - 5 * 60000;
      setReminderHint(
        id
          ? "Reminder set for 5 minutes before."
          : date <= Date.now()
            ? "The reminder time has already passed."
            : Platform.OS === "web"
              ? "Saved. Device reminders are available in the iOS and Android app."
              : "Saved. Allow notifications on your device to receive an alert.",
      );
    } finally {
      setSaving(false);
    }
  };
  const toggleStep = (id: string) => {
    if (active.completed) return;
    tap();
    update(active.id, {
      completedSteps: completed.includes(id)
        ? completed.filter((s) => s !== id)
        : [...completed, id],
    });
  };
  const toggleTask = async () => {
    if (saving) return;
    setSaving(true);
    tap();
    const done = !active.completed;
    update(active.id, { completed: done, notificationId: undefined });
    try {
      await cancelReminder(active.notificationId);
      if (!done && !active.startedAt) {
        const id = await scheduleReminder(active);
        update(active.id, { notificationId: id });
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <BackButton onPress={onClose} />
            <LogoMenu size={22} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={[styles.title, active.completed && styles.strike]}>
              {active.title}
            </Text>
            <Text style={styles.when}>
              {timeLabel(active.time)}
              {active.note?.includes("Deadline") ? " · Deadline" : ""}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving || active.completed || !!active.startedAt}
                accessibilityLabel={
                  active.startedAt ? "Task started" : "Start task"
                }
                onPress={startTask}
                style={[
                  styles.startButton,
                  (active.completed || !!active.startedAt) &&
                    styles.startedButton,
                ]}
              >
                <Text
                  style={[
                    styles.startText,
                    (active.completed || !!active.startedAt) && {
                      color: "#888",
                    },
                  ]}
                >
                  {active.startedAt ? "Started" : "Start"}
                </Text>
              </Pressable>
              {!active.startedAt && !active.completed && (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={remind}
                  style={styles.remindButton}
                >
                  <Text style={styles.remindText}>
                    {active.notificationId && active.reminderMinutes === 5
                      ? "Reminder set · 5 min"
                      : "Remind me 5 min before"}
                  </Text>
                </Pressable>
              )}
            </View>
            {active.startedAt && (
              <Text style={styles.startTime}>
                Started{" "}
                {new Date(active.startedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            )}
            {!!reminderHint && (
              <Text accessibilityLiveRegion="polite" style={styles.startTime}>
                {reminderHint}
              </Text>
            )}
            {next && (
              <View style={styles.next}>
                <Text style={styles.eyebrow}>NEXT STEP</Text>
                <Animated.View key={next.id} entering={FadeIn.duration(180)}>
                  <Text style={styles.nextTitle}>{next.title}</Text>
                  <Text style={styles.nextTime}>{next.time}</Text>
                </Animated.View>
              </View>
            )}
            <View style={styles.planHeading}>
              <Text style={styles.eyebrow}>YOUR PLAN</Text>
            </View>
            <View style={styles.timeline}>
              {plan.steps.map((step, index) => {
                const done = active.completed || completed.includes(step.id);
                return (
                  <Animated.View
                    key={step.id}
                    layout={LinearTransition.duration(180)}
                    style={styles.step}
                  >
                    <View style={styles.rail}>
                      {index < plan.steps.length - 1 && (
                        <View style={styles.line} />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${done ? "Reopen" : "Complete"} step: ${step.title}`}
                        accessibilityState={{ disabled: active.completed }}
                        disabled={active.completed}
                        onPress={() => toggleStep(step.id)}
                        style={styles.circleTarget}
                      >
                        <View
                          style={[
                            styles.circle,
                            next?.id === step.id && styles.currentCircle,
                            done && styles.doneCircle,
                          ]}
                        />
                      </Pressable>
                    </View>
                    <View style={styles.stepBody}>
                      <Text style={styles.stepTime}>
                        {step.time}
                        {step.date !== active.date
                          ? ` · ${dayLabel(step.date)}`
                          : ""}
                      </Text>
                      <Text style={[styles.stepTitle, done && styles.strike]}>
                        {step.title}
                      </Text>
                      <Text style={styles.detail}>{step.detail}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
            <View style={styles.habit}>
              <Text style={styles.eyebrow}>
                {plan.habit.title.toUpperCase()}
              </Text>
              <Text style={styles.habitText}>{plan.habit.text}</Text>
              {plan.habit.remembered && (
                <Text style={styles.caption}>
                  From what you shared with tempo.
                </Text>
              )}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={toggleTask}
              style={[styles.primary, saving && { opacity: 0.5 }]}
            >
              <GradientFill radius={16} />
              <Text style={styles.primaryText}>
                {active.completed ? "Mark incomplete" : "Mark complete"}
              </Text>
            </Pressable>
            <View style={styles.feedbackSlot}>
              {!active.completed && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    onFeedback(
                      `I missed ${active.title.toLowerCase()} because `,
                    )
                  }
                  style={styles.feedback}
                >
                  <Text style={styles.caption}>Something got in the way</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  shell: { flex: 1, width: "100%", maxWidth: 540, alignSelf: "center" },
  header: {
    height: 66,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footer: { paddingHorizontal: 28, paddingTop: 12, backgroundColor: "#fff" },
  feedbackSlot: { height: 54, justifyContent: "center" },
  content: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 30 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: "500",
    color: "#939393",
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontWeight: "500",
    marginTop: 15,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  startButton: {
    backgroundColor: "#191919",
    borderRadius: 13,
    paddingHorizontal: 23,
    minHeight: 44,
    justifyContent: "center",
  },
  startedButton: { backgroundColor: "#f3f3f3" },
  startText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  remindButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  remindText: { color: "#888", fontSize: 12 },
  startTime: { fontSize: 11, color: "#999", marginTop: 12, lineHeight: 18 },
  when: { fontSize: 14, color: "#777", marginTop: 10 },
  next: {
    marginTop: 30,
    paddingVertical: 23,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e6e6e6",
  },
  nextTitle: {
    fontSize: 19,
    letterSpacing: -0.45,
    marginTop: 13,
    color: "#333",
  },
  nextTime: {
    fontSize: 33,
    fontWeight: "300",
    letterSpacing: -1,
    marginTop: 9,
    color: "#555",
  },
  planHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 29,
    marginBottom: 21,
  },
  caption: { fontSize: 11, color: "#999", lineHeight: 18 },
  timeline: { marginLeft: -11 },
  step: { flexDirection: "row", minHeight: 106 },
  rail: { width: 44, alignItems: "center" },
  line: {
    position: "absolute",
    width: 1,
    top: 23,
    bottom: -23,
    backgroundColor: "#e8e8e8",
  },
  circleTarget: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  currentCircle: { borderColor: "#333", borderWidth: 1.5 },
  doneCircle: { borderColor: "#d6d6d6" },
  stepBody: { flex: 1, paddingLeft: 9, paddingBottom: 25 },
  stepTime: {
    fontSize: 11,
    color: "#999",
    fontVariant: ["tabular-nums"],
    marginBottom: 7,
  },
  stepTitle: { fontSize: 16, letterSpacing: -0.2, color: "#333" },
  detail: { fontSize: 12, lineHeight: 19, color: "#999", marginTop: 7 },
  strike: { textDecorationLine: "line-through", color: "#aaa" },
  habit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#e6e6e6",
    paddingTop: 23,
    gap: 12,
  },
  habitText: { fontSize: 14, lineHeight: 24, color: "#777" },
  primary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#191919",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  feedback: { padding: 20, alignItems: "center" },
});
