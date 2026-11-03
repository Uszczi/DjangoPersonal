import { Text, View } from "react-native";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { formatDuration } from "@personal/shared/timeFormat";
import { lastSevenDays, weekdayShort } from "@personal/shared/timeLog";

import { card } from "@/ui/classes";

type WeekStripProps = {
  /** The stopped entries. */
  entries: TimeEntryResponse[];
  nowTick: number;
};

/** The last seven days' totals as small columns, today in the signal colour. */
export function WeekStrip({ entries, nowTick }: WeekStripProps) {
  const days = lastSevenDays(entries, nowTick);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const top = Math.max(60, ...days.map((day) => day.minutes));

  return (
    <View
      className="mx-4 mt-4 flex-row items-end gap-4 rounded-lg border border-card-line bg-paper p-4"
      accessibilityLabel={`Ostatnie 7 dni: ${formatDuration(total)}`}
    >
      <View>
        <Text className={card.kicker}>OSTATNIE 7 DNI</Text>
        <Text className="font-display text-[22px] font-bold text-ink">
          {formatDuration(total)}
        </Text>
      </View>
      <View className="h-14 flex-1 flex-row items-end gap-1.5">
        {days.map((day, index) => (
          <View key={day.key} className="flex-1 items-center gap-1">
            <View
              className={
                index === days.length - 1
                  ? "w-full rounded-t bg-signal"
                  : "w-full rounded-t bg-accent opacity-60"
              }
              style={{ height: Math.max(2, (day.minutes / top) * 38) }}
            />
            <Text className="font-utility text-[10px] text-muted">
              {weekdayShort(day.key)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
