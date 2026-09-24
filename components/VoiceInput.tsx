import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { VoiceMessage } from "../lib/types";
import { browserDictation, transcribeRecording } from "../lib/voice";
import {
  discardRecording,
  durationLabel,
  saveRecording,
} from "../lib/audioStorage";
import { GradientFill } from "./GradientFill";
import { tap } from "../lib/haptics";
const options = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  web: { bitsPerSecond: 32000 },
};
export function VoiceInput({
  disabled,
  onSend,
  onError,
  onRecording,
  onProcessing,
}: {
  disabled: boolean;
  onSend: (audio: VoiceMessage, text: string) => void;
  onError: (text: string) => void;
  onRecording: (active: boolean) => void;
  onProcessing: (active: boolean) => void;
}) {
  const recorder = useAudioRecorder(options);
  const state = useAudioRecorderState(recorder, 200);
  const [working, setWorking] = useState(false);
  const [recording, setRecording] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const active = useRef(false);
  const started = useRef(0);
  const transcript = useRef("");
  const stopDictation = useRef(() => {});
  const operation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      operation.current++;
      stopDictation.current();
      if (active.current) {
        void recorder
          .stop()
          .then(() => {
            if (recorder.uri) void discardRecording(recorder.uri);
          })
          .catch(() => {});
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    };
  }, [recorder]);
  const finish = async (cancel = false) => {
    if (!active.current || locked.current) return;
    locked.current = true;
    active.current = false;
    setWorking(true);
    onProcessing(true);
    setRecording(false);
    onRecording(false);
    const token = operation.current;
    stopDictation.current();
    try {
      const duration = Math.min(60, (Date.now() - started.current) / 1000);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio was captured. Please try again.");
      if (cancel || duration < 0.5 || !alive.current) {
        await discardRecording(uri);
        return;
      }
      const text =
        Platform.OS === "web"
          ? transcript.current
          : await transcribeRecording(uri);
      if (!alive.current || token !== operation.current) {
        await discardRecording(uri);
        return;
      }
      const audio = await saveRecording(uri, duration);
      await discardRecording(uri);
      if (alive.current) onSend(audio, text);
    } catch (error) {
      if (alive.current)
        onError(
          error instanceof Error
            ? error.message
            : "Could not save your voice message. Please try again.",
        );
    } finally {
      locked.current = false;
      if (alive.current) {
        setWorking(false);
        onProcessing(false);
      }
    }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const timer = setInterval(() => {
      if (active.current && Date.now() - started.current >= 60000)
        void finishRef.current();
    }, 250);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") void finishRef.current(true);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const start = async () => {
    if (locked.current || disabled) return;
    locked.current = true;
    setWorking(true);
    onProcessing(true);
    onError("");
    tap();
    const token = ++operation.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Allow microphone access to send a voice message. You can still type.",
        );
      if (!alive.current || token !== operation.current) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (!alive.current) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      transcript.current = "";
      recorder.record();
      started.current = Date.now();
      active.current = true;
      setRecording(true);
      onRecording(true);
      const stop = await browserDictation((text) => {
        transcript.current = text;
      });
      if (alive.current && active.current) stopDictation.current = stop;
      else stop();
    } catch {
      if (alive.current)
        onError(
          "Could not access the microphone. Allow microphone access in your device or browser settings and try again.",
        );
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      locked.current = false;
      if (alive.current) {
        setWorking(false);
        onProcessing(false);
      }
    }
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
      {recording && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel voice message"
            onPress={() => void finish(true)}
            style={{ padding: 10 }}
          >
            <Ionicons name="close" size={17} color="#777" />
          </Pressable>
          <Text
            style={{
              fontSize: 12,
              color: "#555",
              fontVariant: ["tabular-nums"],
            }}
          >
            {durationLabel(state.durationMillis / 1000)}
          </Text>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          recording ? "Send voice message" : "Record voice message"
        }
        disabled={working || disabled}
        onPress={() => void (recording ? finish() : start())}
        style={{
          width: 42,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: working || disabled ? 0.4 : 1,
        }}
      >
        {recording && <GradientFill radius={22} />}
        <Ionicons
          name={
            recording
              ? "arrow-up"
              : working
                ? "ellipsis-horizontal"
                : "mic-outline"
          }
          size={21}
          color={recording ? "#fff" : "#555"}
        />
      </Pressable>
    </View>
  );
}
