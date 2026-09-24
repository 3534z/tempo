import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { VoiceMessage } from "../lib/types";
import { durationLabel, recordingUri } from "../lib/audioStorage";
export function VoiceMessagePlayer({ audio }: { audio: VoiceMessage }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready && status.isLoaded) {
      player.play();
      setReady(false);
    }
  }, [ready, status.isLoaded, player]);
  const play = async () => {
    try {
      setError("");
      if (status.playing) {
        player.pause();
        return;
      }
      if (status.isLoaded) {
        if (status.didJustFinish || status.currentTime >= status.duration - 0.1)
          await player.seekTo(0);
        player.play();
        return;
      }
      setLoading(true);
      const uri = await recordingUri(audio);
      player.replace({ uri });
      setReady(true);
    } catch {
      setError("Could not play this recording.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? "Pause voice message" : "Play voice message"
        }
        disabled={loading}
        onPress={() => void play()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          minWidth: 175,
          paddingVertical: 7,
        }}
      >
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={19}
          color="#333"
        />
        <Text style={{ fontSize: 13, color: "#555", flex: 1 }}>
          Voice message
        </Text>
        <Text
          style={{ fontSize: 11, color: "#999", fontVariant: ["tabular-nums"] }}
        >
          {durationLabel(status.playing ? status.currentTime : audio.duration)}
        </Text>
      </Pressable>
      {!!error && <Text style={{ fontSize: 11, color: "#777" }}>{error}</Text>}
    </View>
  );
}
