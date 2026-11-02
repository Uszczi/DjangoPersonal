import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { entryCountLabel } from "@personal/shared/counterFormat";
import {
  daysInMonth,
  dayOfMonth,
  leadingBlankDays,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  WEEKDAY_LABELS,
  type MonthKey,
} from "@personal/shared/expenseMonth";
import type { CounterEntryResponse } from "@personal/shared/generated/api";

import { useTheme } from "@/theme";
import { NamedIcon } from "@/ui/NamedIcon";

const dayName = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

// Seven cells a row: a seventh of the width each, the gap inside the cell.
const CELL = "w-[14.2857%] p-0.5";

/** A local calendar day as `yyyy-mm-d`, the key entries are grouped by. */
function dayKey(month: MonthKey, day: number) {
  return `${month}-${day}`;
}

/**
 * A month of a Counter's entries, like the web's: days with at least one
 * entry are marked, today is ringed. Days are local, so an entry late in the
 * evening lands on the day the user saw it.
 */
export function CounterCalendar({
  entries,
}: {
  entries: CounterEntryResponse[];
}) {
  const { colors } = useTheme();
  // Read the clock once, on mount: it picks the starting month and the day to ring.
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthKeyOf(today));

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const at = entry.occurredAt;
      const key = dayKey(monthKeyOf(at), at.getDate());
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const todayKey = dayKey(monthKeyOf(today), today.getDate());
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);

  return (
    <View accessibilityLabel="Kalendarz wpisów" className="mt-5">
      <View className="mb-2 flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Poprzedni miesiąc"
          hitSlop={8}
          onPress={() => setMonth((shown) => shiftMonth(shown, -1))}
          className="px-3 py-2 active:opacity-60"
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
          className="flex-1 text-center text-[15px] font-semibold text-ink"
        >
          {monthLabel(month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Następny miesiąc"
          hitSlop={8}
          onPress={() => setMonth((shown) => shiftMonth(shown, 1))}
          className="px-3 py-2 active:opacity-60"
        >
          <NamedIcon
            name="chevron-right"
            fallback="chevron-right"
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className={CELL}>
            <Text className="text-center font-utility text-[10px] font-semibold text-muted">
              {label.toUpperCase()}
            </Text>
          </View>
        ))}
        {Array.from({ length: leadingBlankDays(month) }, (_, index) => (
          <View key={`blank-${index}`} className={CELL} />
        ))}
        {days.map((day) => {
          const key = dayKey(month, day);
          const count = countsByDay.get(key) ?? 0;
          const marked = count > 0;
          return (
            <View key={key} className={CELL}>
              <View
                accessible
                accessibilityLabel={`${dayName.format(dayOfMonth(month, day))}: ${
                  marked ? entryCountLabel(count) : "brak wpisów"
                }`}
                className={
                  marked
                    ? "aspect-square items-center justify-center rounded-md bg-accent"
                    : "aspect-square items-center justify-center rounded-md"
                }
                style={
                  key === todayKey
                    ? { borderWidth: 2, borderColor: colors.signal }
                    : undefined
                }
              >
                <Text
                  className={
                    marked
                      ? "text-[13px] font-semibold text-paper"
                      : "text-[13px] text-ink-soft"
                  }
                >
                  {day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
