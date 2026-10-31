import { Text, View } from "react-native";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import {
  dateKey,
  entryMinutes,
  formatDuration,
} from "@personal/shared/timeFormat";

import { fonts, makeStyles, useTheme } from "../../theme";
import { daysAgoKey } from "./entryDays";

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
  const { common, card } = useTheme();
  const styles = useStyles();

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
    <View style={card.section}>
      <Text style={card.title}>Suma czasu</Text>
      <Text style={card.kicker}>DZIŚ ŁĄCZNIE</Text>
      <Text style={styles.total}>{formatDuration(todaysMinutes)}</Text>

      <Text style={[card.kicker, { marginTop: 8 }]}>WEDŁUG ZADANIA (DZIŚ)</Text>
      {perTaskMinutes.size === 0 ? (
        <Text style={common.muted}>Brak wpisów.</Text>
      ) : (
        [...perTaskMinutes.entries()].map(([taskId, minutes]) => (
          <View key={taskId} style={styles.summaryRow}>
            <Text style={styles.summaryLabel} numberOfLines={1}>
              {taskTitles.get(taskId) ?? `Zadanie #${taskId}`}
            </Text>
            <Text style={common.muted}>{formatDuration(minutes)}</Text>
          </View>
        ))
      )}

      <Text style={[card.kicker, { marginTop: 8 }]}>OSTATNIE 7 DNI</Text>
      {dayKeys.map((key) => (
        <View key={key} style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{key}</Text>
          <Text style={common.muted}>
            {formatDuration(minutesByDay.get(key) ?? 0)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  total: {
    fontFamily: fonts.utility,
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { flex: 1, color: colors.ink },
}));
