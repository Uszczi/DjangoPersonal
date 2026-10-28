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
    // Echoes the web's signal tiles and logo mark rather than a round FAB.
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.deepInk,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  pressed: { opacity: 0.8 },
  label: { color: colors.onPrimary, fontSize: 30, lineHeight: 32 },
});
