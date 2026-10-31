import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";

const ROW =
  "min-h-[52px] flex-row items-center gap-3.5 border-b border-row-line px-1";

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
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Zamknij menu"
        className="flex-1 justify-end bg-overlay"
        onPress={onClose}
      >
        <Pressable
          className="max-h-[80%] rounded-t-xl bg-paper px-4 pt-4"
          style={{ paddingBottom: 12 + insets.bottom }}
          // Taps inside the sheet must not reach the backdrop.
          onPress={() => {}}
        >
          <Text className="mb-1 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">{title.toUpperCase()}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      className={`${ROW} active:opacity-60`}
    >
      {icon && <Ionicons name={icon} size={22} color={colors.ink} />}
      <Text
        numberOfLines={1}
        className={
          isSelected
            ? "flex-1 text-[15px] font-bold text-ink"
            : "flex-1 text-[15px] font-medium text-ink"
        }
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
  return <View className={ROW}>{children}</View>;
}
