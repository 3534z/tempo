import Constants from "expo-constants";
import { Platform } from "react-native";

/** Native file recognition always requests on-device processing. */
export async function transcribeRecording(uri: string): Promise<string> {
  if (Platform.OS === "web" || Constants.appOwnership === "expo") return "";
  try {
    const { ExpoSpeechRecognitionModule: speech } =
      await import("expo-speech-recognition");
    if (!speech.supportsOnDeviceRecognition()) return "";
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) return "";
    return await new Promise<string>((resolve) => {
      let transcript = "";
      let settled = false;
      const subscriptions: { remove: () => void }[] = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        subscriptions.forEach((s) => s.remove());
        try {
          speech.abort();
        } catch {}
        resolve(transcript);
      };
      const timeout = setTimeout(finish, 15000);
      subscriptions.push(
        speech.addListener("result", (event) => {
          transcript = event.results[0]?.transcript || transcript;
        }),
        speech.addListener("end", finish),
        speech.addListener("error", finish),
      );
      try {
        speech.start({
          lang: "en-US",
          requiresOnDeviceRecognition: true,
          audioSource: { uri, sampleRate: 16000, audioChannels: 1 },
          interimResults: false,
        });
      } catch {
        finish();
      }
    });
  } catch {
    return "";
  }
}

// Browser transcription is optional. Never fall back to a cloud recognizer.
interface LocalRecognizer {
  processLocally: boolean;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
export async function browserDictation(
  onText: (text: string) => void,
): Promise<() => void> {
  if (Platform.OS !== "web") return () => {};
  try {
    const scope = globalThis as unknown as {
      SpeechRecognition?: {
        new (): LocalRecognizer;
        available?: (options: {
          langs: string[];
          processLocally: boolean;
        }) => Promise<string>;
      };
    };
    const Recognition = scope.SpeechRecognition;
    if (
      !Recognition?.available ||
      (await Recognition.available({
        langs: ["en-US"],
        processLocally: true,
      })) !== "available"
    )
      return () => {};
    const recognition = new Recognition();
    recognition.processLocally = true;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) =>
      onText(
        Array.from(event.results)
          .map((result) => result[0]?.transcript || "")
          .join(" "),
      );
    recognition.onerror = () => {};
    recognition.start();
    return () => {
      recognition.onresult = null;
      recognition.abort();
    };
  } catch {
    return () => {};
  }
}
