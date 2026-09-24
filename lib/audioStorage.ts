import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { VoiceMessage, uid } from "./types";
export async function saveRecording(
  uri: string,
  duration: number,
): Promise<VoiceMessage> {
  const id = uid();
  let data: string;
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const fs = await import("expo-file-system/legacy");
    data = `data:audio/mp4;base64,${await fs.readAsStringAsync(uri, { encoding: fs.EncodingType.Base64 })}`;
  }
  // Each clip gets its own key to keep Android's individual storage rows small.
  if (data.length > 1500000)
    throw new Error("This recording is too large. Try a shorter message.");
  await AsyncStorage.setItem(`tempo-audio-${id}`, data);
  return { id, duration };
}
export async function recordingUri(audio: VoiceMessage): Promise<string> {
  const data = await AsyncStorage.getItem(`tempo-audio-${audio.id}`);
  if (!data) throw new Error("Recording not found");
  if (Platform.OS === "web") return data;
  const fs = await import("expo-file-system/legacy");
  const uri = `${fs.cacheDirectory}tempo-voice-${audio.id}.m4a`;
  await fs.writeAsStringAsync(uri, data.slice(data.indexOf(",") + 1), {
    encoding: fs.EncodingType.Base64,
  });
  return uri;
}
export async function discardRecording(uri: string) {
  try {
    if (Platform.OS === "web") URL.revokeObjectURL(uri);
    else
      await (
        await import("expo-file-system/legacy")
      ).deleteAsync(uri, { idempotent: true });
  } catch {
    /* Cache cleanup must not discard an already saved message. */
  }
}
export const durationLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
