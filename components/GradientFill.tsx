import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
/** Shared palette from the supplied gradient reference. */
export function GradientFill({ radius = 30 }: { radius?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["#56E1E8", "#3FA9F5", "#5C58ED", "#122D70"]}
      locations={[0, 0.28, 0.65, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}
