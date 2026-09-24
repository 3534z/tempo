import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Logo } from "./Logo";
import { tap } from "../lib/haptics";
export function LogoMenu({ size = 28 }: { size?: number }) {
  const anchor = useRef<View>(null);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const { width, height } = useWindowDimensions();
  const open = () => {
    tap();
    anchor.current?.measureInWindow((x, y, w, h) =>
      setPosition({
        top: Math.min(y + h + 12, height - 160),
        right: Math.max(16, width - x - w),
      }),
    );
  };
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityState={{ expanded: !!position }}
          onPress={open}
          hitSlop={12}
        >
          <Logo size={size} />
        </Pressable>
      </View>
      <Modal
        visible={!!position}
        transparent
        animationType="fade"
        onRequestClose={() => setPosition(null)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPosition(null)}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          <View style={[styles.menu, position]}>
            <Text style={styles.heading}>TEMPO</Text>
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={styles.row}
            >
              <Ionicons name="settings-outline" size={17} color="#aaa" />
              <Text style={styles.label}>Settings</Text>
            </Pressable>
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={styles.row}
            >
              <Ionicons name="person-outline" size={17} color="#aaa" />
              <Text style={styles.label}>Account</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1 },
  menu: {
    position: "absolute",
    width: 205,
    padding: 18,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heading: { fontSize: 9, letterSpacing: 1.7, color: "#aaa", marginBottom: 9 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 44 },
  label: { fontSize: 14, color: "#999" },
});
