import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "./theme";

type FabProps = { accessibilityLabel: string; onPress: () => void };

/**
 * The floating "+" in the bottom-right corner. Screen actions live in the
 * body rather than the native header, where buttons can miss taps on Android.
 */
export function Fab({ accessibilityLabel, onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Text style={styles.label}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  pressed: { opacity: 0.8 },
  label: { color: colors.onPrimary, fontSize: 30, lineHeight: 32 },
});
