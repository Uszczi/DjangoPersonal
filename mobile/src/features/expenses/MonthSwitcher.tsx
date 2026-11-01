import { Pressable, Text, View } from "react-native";

import {
  monthLabel,
  shiftMonth,
  type MonthKey,
} from "@personal/shared/expenseMonth";

import { useTheme } from "@/theme";
import { NamedIcon } from "@/ui/NamedIcon";

type MonthSwitcherProps = {
  month: MonthKey;
  onChange: (month: MonthKey) => void;
};

/** The shown month with arrows to the previous and the next one. */
export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const { colors } = useTheme();
  return (
    <View className="mx-4 mt-4 flex-row items-center rounded-lg border border-control-border bg-paper">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Poprzedni miesiąc"
        onPress={() => onChange(shiftMonth(month, -1))}
        className="px-4 py-3 active:opacity-60"
      >
        <NamedIcon
          name="chevron-left"
          fallback="chevron-left"
          size={18}
          color={colors.inkSoft}
        />
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        className="flex-1 text-center text-sm font-semibold text-ink"
      >
        {monthLabel(month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Następny miesiąc"
        onPress={() => onChange(shiftMonth(month, 1))}
        className="px-4 py-3 active:opacity-60"
      >
        <NamedIcon
          name="chevron-right"
          fallback="chevron-right"
          size={18}
          color={colors.inkSoft}
        />
      </Pressable>
    </View>
  );
}
