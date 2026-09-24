import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientFill } from "./GradientFill";
import { tap } from "../lib/haptics";
export function FloatingPlus({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Plan with tempo"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          bottom: Math.max(insets.bottom, 22) + 10,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <GradientFill />
      <Ionicons name="add" size={29} color="#fff" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    position: "absolute",
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#161616",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
});
