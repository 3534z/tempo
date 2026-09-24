import { View, Text, StyleSheet } from "react-native";
import { LogoMenu } from "./LogoMenu";
export function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.wordmark}>
        tempo<Text style={{ color: "#9b9b9b" }}>.</Text>
      </Text>
      <LogoMenu />
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 34,
  },
  wordmark: { fontSize: 25, fontWeight: "600", letterSpacing: -1.2 },
});
