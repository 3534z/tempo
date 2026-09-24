import { View } from "react-native";
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="tempo"
      style={{
        width: size,
        height: size,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        transform: [{ rotate: "-18deg" }],
      }}
    >
      {[0.55, 1, 0.76].map((h, i) => (
        <View
          key={i}
          style={{
            width: size / 6,
            height: size * h,
            borderRadius: 4,
            backgroundColor: "#181818",
          }}
        />
      ))}
    </View>
  );
}
