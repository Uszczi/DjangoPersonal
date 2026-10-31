import { Pressable, Text, View } from "react-native";

/** A year's (or the planned items') header: tapping it folds its rows away or back. */
export function YearBar({
  label,
  count,
  isOpen,
  onPress,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${/^\d+$/.test(label) ? `Rok ${label}` : label}, ${count}`}
      accessibilityState={{ expanded: isOpen }}
      onPress={onPress}
      className="mx-3 mt-3 flex-row items-center gap-2 rounded-[5px] bg-wash px-3 py-2.5 active:opacity-60"
    >
      <Text className="w-3 text-sm text-ink">{isOpen ? "▾" : "▸"}</Text>
      <Text className="text-[16px] font-semibold text-ink">{label}</Text>
      <Text className="ml-auto text-xs text-muted">{count}</Text>
    </Pressable>
  );
}

/** A month inside a year: a thin rule with the month's name in the middle. */
export function MonthRule({ label }: { label: string }) {
  return (
    <View
      className="flex-row items-center gap-2.5 px-4 pt-3.5 pb-1"
      accessibilityRole="header"
    >
      <View className="h-px flex-1 bg-line" />
      <Text className="font-utility text-[11px] font-semibold tracking-[1px] text-muted">
        {label.toUpperCase()}
      </Text>
      <View className="h-px flex-1 bg-line" />
    </View>
  );
}
