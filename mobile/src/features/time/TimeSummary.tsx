import { Text, View } from "react-native";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import {
  dateKey,
  entryMinutes,
  formatDuration,
} from "@personal/shared/timeFormat";

import { card, common } from "@/ui/classes";
import { daysAgoKey } from "@/features/time/entryDays";

type TimeSummaryProps = {
  /** The stopped entries. */
  entries: TimeEntryResponse[];
  nowTick: number;
  taskTitles: ReadonlyMap<number, string>;
};

/** Suma czasu: today's total, today per task, and each of the last 7 days. */
export function TimeSummary({
  entries,
  nowTick,
  taskTitles,
}: TimeSummaryProps) {
  const today = dateKey(new Date(nowTick));
  const todaysEntries = entries.filter(
    (entry) => dateKey(entry.start) === today,
  );
  const todaysMinutes = todaysEntries.reduce(
    (sum, entry) => sum + entryMinutes(entry),
    0,
  );
  const perTaskMinutes = new Map<number, number>();
  for (const entry of todaysEntries) {
    if (entry.taskId == null) continue;
    perTaskMinutes.set(
      entry.taskId,
      (perTaskMinutes.get(entry.taskId) ?? 0) + entryMinutes(entry),
    );
  }
  const dayKeys = Array.from({ length: 7 }, (_, index) =>
    daysAgoKey(nowTick, 6 - index),
  );
  const minutesByDay = new Map(dayKeys.map((key) => [key, 0]));
  for (const entry of entries) {
    const key = dateKey(entry.start);
    if (minutesByDay.has(key))
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + entryMinutes(entry));
  }

  return (
    <View className={card.section}>
      <Text className={card.title}>Suma czasu</Text>
      <Text className={card.kicker}>DZIŚ ŁĄCZNIE</Text>
      <Text className="font-utility text-[24px] font-bold text-ink">
        {formatDuration(todaysMinutes)}
      </Text>

      <Text className="mt-2 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
        WEDŁUG ZADANIA (DZIŚ)
      </Text>
      {perTaskMinutes.size === 0 ? (
        <Text className={common.muted}>Brak wpisów.</Text>
      ) : (
        [...perTaskMinutes.entries()].map(([taskId, minutes]) => (
          <View key={taskId} className="flex-row justify-between gap-3">
            <Text className="flex-1 text-ink" numberOfLines={1}>
              {taskTitles.get(taskId) ?? `Zadanie #${taskId}`}
            </Text>
            <Text className={common.muted}>{formatDuration(minutes)}</Text>
          </View>
        ))
      )}

      <Text className="mt-2 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
        OSTATNIE 7 DNI
      </Text>
      {dayKeys.map((key) => (
        <View key={key} className="flex-row justify-between gap-3">
          <Text className="flex-1 text-ink">{key}</Text>
          <Text className={common.muted}>
            {formatDuration(minutesByDay.get(key) ?? 0)}
          </Text>
        </View>
      ))}
    </View>
  );
}
