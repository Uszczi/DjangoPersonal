import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, useTheme } from "./theme";

/**
 * A popup sliding from the bottom of the screen over a dimmed backdrop, with
 * a small heading; a tap on the backdrop (or Back) closes it. The Więcej
 * menu, the Project picker and the task list settings are all one of these.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Zamknij menu"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}
          // Taps inside the sheet must not reach the backdrop.
          onPress={() => {}}
        >
          <Text style={styles.kicker}>{title.toUpperCase()}</Text>
          <ScrollView bounces={false}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** One tappable row of a Sheet: an icon, a label and a tick when selected. */
export function SheetItem({
  icon,
  label,
  isSelected = false,
  onPress,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  label: string;
  isSelected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon && <Ionicons name={icon} size={22} color={colors.ink} />}
      <Text
        numberOfLines={1}
        style={[styles.title, isSelected && styles.titleSelected]}
      >
        {label}
      </Text>
      {isSelected && (
        <Ionicons name="checkmark" size={20} color={colors.signal} />
      )}
    </Pressable>
  );
}

/** A Sheet row holding a control of its own, such as a switch. */
export function SheetRow({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.row}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: "80%",
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.paper,
  },
  kicker: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  titleSelected: { fontWeight: "700" },
}));
