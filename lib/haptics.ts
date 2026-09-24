import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
export const tap = () => {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
};
