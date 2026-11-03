import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { useStartTimer } from "@personal/shared/queries/timer";
import {
  entryMinutes,
  formatClock,
  formatDuration,
} from "@personal/shared/timeFormat";
import {
  dayLabel,
  entryTitle,
  groupLogDays,
  LOG_DAYS_STEP,
} from "@personal/shared/timeLog";
import { seriesColor, seriesResolver } from "@personal/shared/timeStats";

import { card, common } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { useTheme } from "@/theme";

type TimeLogProps = {
  /** The stopped entries. */
  entries: TimeEntryResponse[];
  nowTick: number;
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  taskTitles: ReadonlyMap<number, string>;
  /** Called once a resumed timer has started, so the clock restarts from now. */
  onStarted: () => void;
};

/**
 * The Dziennik: stopped entries grouped by day with each day's total, two
 * weeks at first and older ones on request. A tap edits an entry; its play
 * button starts a timer on the same Task or title.
 */
export function TimeLog({
  entries,
  nowTick,
  tasks,
  projects,
  taskTitles,
  onStarted,
}: TimeLogProps) {
  const { colors, scheme } = useTheme();
  const startTimer = useStartTimer();
  const [days, setDays] = useState(LOG_DAYS_STEP);
  const [error, setError] = useState("");
  const log = groupLogDays(entries, nowTick, days);
  const seriesOf = seriesResolver(tasks, projects);

  async function resume(entry: TimeEntryResponse) {
    setError("");
    try {
      await startTimer.mutateAsync(
        entry.taskId != null ? { task: entry.taskId } : { title: entry.title },
      );
      onStarted();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <View>
      <View className="mx-4 mt-4 flex-row">
        <Button
          label="+ Dodaj wpis ręcznie"
          variant="secondary"
          onPress={() => router.push("/time-entry")}
        />
      </View>
      {error !== "" && <Text className={common.error}>{error}</Text>}
      {log.days.length === 0 && (
        <View className={card.section}>
          <Text className={common.muted}>
            {log.hasOlder
              ? `Brak wpisów z ostatnich ${days} dni.`
              : "Nie ma jeszcze wpisów. Uruchom timer albo dodaj wpis ręcznie."}
          </Text>
        </View>
      )}
      {log.days.map((day) => (
        <View
          key={day.key}
          className="mx-4 mt-4 rounded-lg border border-card-line bg-paper"
        >
          <View className="flex-row items-center justify-between border-b border-row-line px-4 py-3">
            <Text className="font-display text-[15px] font-bold text-ink">
              {dayLabel(day.key, nowTick)}
            </Text>
            <Text className="font-utility text-xs font-semibold text-ink-soft">
              {formatDuration(day.minutes)}
            </Text>
          </View>
          {day.entries.map((entry, index) => {
            const title = entryTitle(entry, taskTitles);
            const series = seriesOf(entry);
            return (
              <View
                key={entry.id}
                className={
                  index === day.entries.length - 1
                    ? "flex-row items-center gap-2 pl-4 pr-1"
                    : "flex-row items-center gap-2 border-b border-row-line pl-4 pr-1"
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edytuj wpis: ${title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/time-entry",
                      params: { entryId: entry.id },
                    })
                  }
                  className="flex-1 flex-row items-center gap-2 py-2.5 active:opacity-60"
                >
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="text-sm font-medium text-ink"
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      {series.key !== "none" && (
                        <View className="shrink flex-row items-center gap-1.5">
                          <View
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: seriesColor(series.slot, scheme),
                            }}
                          />
                          <Text
                            className="shrink text-xs text-ink-soft"
                            numberOfLines={1}
                          >
                            {series.name}
                          </Text>
                        </View>
                      )}
                      <Text className="font-utility text-[11px] text-muted">
                        {formatClock(entry.start)}–
                        {entry.end ? formatClock(entry.end) : "…"}
                      </Text>
                    </View>
                  </View>
                  <Text className="font-utility text-[13px] font-semibold text-ink">
                    {formatDuration(entryMinutes(entry))}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Wznów: ${title}`}
                  hitSlop={6}
                  disabled={startTimer.isPending}
                  onPress={() => void resume(entry)}
                  className="size-10 items-center justify-center rounded-full active:bg-icon-wash"
                >
                  <Ionicons name="play" size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
      {log.hasOlder && (
        <View className="mx-4 mt-4 flex-row">
          <Button
            label="Pokaż starsze"
            variant="secondary"
            onPress={() => setDays((current) => current + LOG_DAYS_STEP)}
          />
        </View>
      )}
    </View>
  );
}
