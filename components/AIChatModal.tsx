import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCalendar, useChat, useMemory, useTasks } from "../stores";
import { Message, uid } from "../lib/types";
import { executeAiActions, requestAiPlan } from "../lib/ai";
import { cancelReminder, scheduleReminder } from "../lib/notifications";
import { VoiceInput } from "./VoiceInput";
import { tap } from "../lib/haptics";
import { ChatMessage } from "./ChatMessage";
import { BackButton } from "./BackButton";
import { GradientFill } from "./GradientFill";
import { LogoMenu } from "./LogoMenu";
export function AIChatModal({
  visible,
  onClose,
  initialText = "",
}: {
  visible: boolean;
  onClose: () => void;
  initialText?: string;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");
  const [requestError, setRequestError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const lock = useRef(false);
  const insets = useSafeAreaInsets();
  const messages = useChat((s) => s.messages);
  const addMessage = useChat((s) => s.add);
  const status = useChat((s) => s.status);
  const remember = useMemory((s) => s.remember);
  const addTasks = useTasks((s) => s.add);
  const updateTask = useTasks((s) => s.update);
  const removeTask = useTasks((s) => s.remove);
  const select = useCalendar((s) => s.select);
  useEffect(() => {
    if (visible) {
      setInput(initialText);
      setVoiceHint("");
      setRequestError("");
    } else {
      setListening(false);
      setVoiceBusy(false);
    }
  }, [visible, initialText]);
  const reply = (text: string, plan?: Message["plan"]) => {
    addMessage({
      id: uid(),
      role: "assistant",
      text,
      plan,
      status: plan ? "pending" : undefined,
    });
  };
  const send = async () => {
    const text = input.trim();
    if (!text || busy || voiceBusy) return;
    tap();
    setListening(false);
    setInput("");
    setVoiceHint("");
    setRequestError("");
    addMessage({ id: uid(), role: "user", text });
    if (/^(yes|confirm|looks good|okay|ok)[.!]?$/i.test(text)) {
      const pending = [...useChat.getState().messages]
        .reverse()
        .find((m) => m.status === "pending");
      if (pending) {
        void confirm(pending);
        return;
      }
    }
    setBusy(true);
    try {
      const result = await requestAiPlan(
        text,
        useTasks.getState().tasks,
        useMemory.getState().memories,
      );
      const created = await executeAiActions(result.actions, {
        getTasks: () => useTasks.getState().tasks,
        addTasks,
        updateTask,
        removeTask,
        remember,
        schedule: scheduleReminder,
        cancel: cancelReminder,
      });
      if (created[0]) select(created[0].date);
      reply(result.reply);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Tempo could not create a plan. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const confirm = async (message: Message) => {
    if (
      lock.current ||
      !message.plan?.length ||
      useChat.getState().messages.find((m) => m.id === message.id)?.status !==
        "pending"
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      tap();
      addTasks(message.plan);
      status(message.id, "saved");
      select(message.plan[0].date);
      let scheduled = 0;
      for (const task of message.plan) {
        const id = await scheduleReminder(task);
        if (id) {
          scheduled++;
          useTasks.getState().update(task.id, { notificationId: id });
        }
      }
      reply(
        `All set. Your ${message.plan.length === 1 ? "plan is" : "plans are"} in the calendar.${scheduled ? ` ${scheduled} ${scheduled === 1 ? "reminder is" : "reminders are"} scheduled.` : " Reminder times are saved. Device alerts need notification permission and a future reminder time on iOS or Android."}`,
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      {visible && (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[styles.shell, { paddingTop: Math.max(insets.top, 16) }]}
          >
            <View style={styles.header}>
              <BackButton onPress={onClose} />
              <LogoMenu size={21} />
            </View>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.messages,
                !messages.length && { flexGrow: 1 },
              ]}
              onContentSizeChange={() =>
                scroll.current?.scrollToEnd({ animated: true })
              }
            >
              {!messages.length ? (
                <View style={styles.welcome}>
                  <Text style={styles.kicker}>LESS ON YOUR MIND.</Text>
                  <Text style={styles.welcomeTitle}>
                    Make room for what matters.
                  </Text>
                  <Text style={styles.welcomeText}>
                    Tell me about your day. We’ll find a place for everything.
                  </Text>
                  <Text style={styles.example}>
                    “Tomorrow, dentist at 11, go to the gym and finish my
                    project before 8 PM.”
                  </Text>
                </View>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    busy={busy || voiceBusy || listening}
                    onConfirm={confirm}
                  />
                ))
              )}
            </ScrollView>
            <View
              style={[
                styles.composerArea,
                { paddingBottom: Math.max(insets.bottom, 18) },
              ]}
            >
              {voiceHint ? (
                <Text style={styles.hint}>{voiceHint}</Text>
              ) : requestError ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorHint}>
                  {requestError}
                </Text>
              ) : busy ? (
                <Text accessibilityLiveRegion="polite" style={styles.hint}>
                  Tempo is thinking…
                </Text>
              ) : listening ? (
                <Text style={styles.hint}>
                  Listening · Tap the arrow when finished
                </Text>
              ) : null}
              <View style={styles.composer}>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Tell tempo your plans"
                  placeholder="Ask Tempo"
                  placeholderTextColor="#999"
                  selectionColor="#b5b5b5"
                  underlineColorAndroid="transparent"
                  value={input}
                  editable={!listening && !voiceBusy}
                  onChangeText={setInput}
                  multiline
                  maxLength={2000}
                  style={styles.input}
                  onSubmitEditing={() => {
                    if (Platform.OS === "web") send();
                  }}
                />
                <VoiceInput
                  onProcessing={setVoiceBusy}
                  disabled={busy}
                  onRecording={setListening}
                  onError={setVoiceHint}
                  onTranscript={(text) => {
                    setInput(text);
                    inputRef.current?.focus();
                  }}
                />
                {!!input.trim() && !listening && (
                  <Pressable
                    disabled={busy || voiceBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Send plan"
                    onPress={() => void send()}
                    style={styles.send}
                  >
                    <GradientFill radius={17} />
                    <Ionicons name="arrow-up" size={19} color="white" />
                  </Pressable>
                )}
              </View>
              <Text style={styles.privacy}>
                Your voice is converted to text before planning.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  shell: { flex: 1, width: "100%", maxWidth: 540, alignSelf: "center" },
  header: {
    paddingHorizontal: 26,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#f4f4f4",
    borderBottomWidth: 1,
  },
  messages: { padding: 28, paddingBottom: 10 },
  welcome: { flex: 1, justifyContent: "center", paddingBottom: 70 },
  kicker: { fontSize: 9, letterSpacing: 2, color: "#aaa", marginBottom: 22 },
  welcomeTitle: {
    fontSize: 39,
    lineHeight: 46,
    fontWeight: "500",
    letterSpacing: -1.8,
  },
  welcomeText: { fontSize: 15, lineHeight: 26, color: "#888", marginTop: 23 },
  example: { fontSize: 12, lineHeight: 22, color: "#aaa", marginTop: 42 },
  composerArea: { paddingHorizontal: 21, paddingTop: 10 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f6f6f6",
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ededed",
  },
  input: {
    flex: 1,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 14,
    maxHeight: 140,
    minHeight: 44,
    color: "#222",
  },
  mic: {
    width: 38,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    backgroundColor: "#181818",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    marginRight: 4,
  },
  privacy: {
    fontSize: 9,
    color: "#aaa",
    textAlign: "center",
    marginTop: 13,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 11,
    lineHeight: 17,
    color: "#888",
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  errorHint: {
    fontSize: 11,
    lineHeight: 17,
    color: "#555",
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
});
