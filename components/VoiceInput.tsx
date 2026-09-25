import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientFill } from "./GradientFill";
import { tap } from "../lib/haptics";

type SpeechModule =
  (typeof import("expo-speech-recognition"))["ExpoSpeechRecognitionModule"];
type Subscription = { remove: () => void };

export function VoiceInput({
  disabled,
  onTranscript,
  onError,
  onRecording,
  onProcessing,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
  onError: (text: string) => void;
  onRecording: (active: boolean) => void;
  onProcessing: (active: boolean) => void;
}) {
  const [working, setWorking] = useState(false);
  const [recording, setRecording] = useState(false);
  const speech = useRef<SpeechModule | null>(null);
  const subscriptions = useRef<Subscription[]>([]);

  const clearListeners = () => {
    subscriptions.current.forEach((subscription) => subscription.remove());
    subscriptions.current = [];
  };

  const finish = () => {
    setRecording(false);
    setWorking(false);
    onRecording(false);
    onProcessing(false);
  };

  useEffect(
    () => () => {
      try {
        speech.current?.abort();
      } catch {}
      clearListeners();
    },
    [],
  );

  const stop = () => {
    setWorking(true);
    onProcessing(true);
    try {
      speech.current?.stop();
    } catch {
      finish();
    }
  };

  const start = async () => {
    if (working || disabled) return;
    setWorking(true);
    onProcessing(true);
    onError("");
    tap();
    try {
      const { ExpoSpeechRecognitionModule } = await import(
        "expo-speech-recognition"
      );
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        throw new Error("Speech recognition is unavailable on this device.");
      }
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          "Allow microphone and speech recognition access to dictate a plan.",
        );
      }

      speech.current = ExpoSpeechRecognitionModule;
      clearListeners();
      subscriptions.current = [
        ExpoSpeechRecognitionModule.addListener("start", () => {
          setRecording(true);
          setWorking(false);
          onRecording(true);
          onProcessing(false);
        }),
        ExpoSpeechRecognitionModule.addListener("result", (event) => {
          const text = event.results[0]?.transcript?.trim();
          if (text) onTranscript(text);
        }),
        ExpoSpeechRecognitionModule.addListener("end", () => {
          finish();
          clearListeners();
        }),
        ExpoSpeechRecognitionModule.addListener("error", (event) => {
          if (event.error !== "aborted" && event.error !== "no-speech") {
            onError(
              event.message || "Speech recognition stopped. Please try again.",
            );
          }
          finish();
          clearListeners();
        }),
      ];
      ExpoSpeechRecognitionModule.start({
        lang: Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Speech recognition is unavailable. You can still type your plan.",
      );
      finish();
      clearListeners();
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? "Finish dictation" : "Dictate a plan"}
        disabled={(working && !recording) || disabled}
        onPress={() => (recording ? stop() : void start())}
        style={{
          width: 42,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: (working && !recording) || disabled ? 0.4 : 1,
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
