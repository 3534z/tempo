import { Pressable, View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tap } from "../lib/haptics";
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to calendar"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.target, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={styles.circle}>
        <Svg width={37} height={37} viewBox="8 8 37 37">
          <Path
            d="M30.123 19.479L22.8789 26.5012L30.123 33.5234"
            stroke="black"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  target: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    backgroundColor: "#fff",
    shadowColor: "#A69797",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    shadowOpacity: 0.25,
    elevation: 3,
  },
});
