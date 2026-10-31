import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import {
  dateKey,
  entryMinutes,
  formatClock,
  formatDuration,
} from "@personal/shared/timeFormat";

import { card, form } from "../../ui/classes";
import { Button } from "../../ui/Button";
import { ChipGroup } from "../../ui/ChipGroup";
import { daysAgoKey, entryTitle } from "./entryDays";

type EntryRange = "today" | "7" | "30" | "all";

const RANGES: { value: EntryRange; label: string }[] = [
  { value: "today", label: "Dziś" },
  { value: "7", label: "7 dni" },
  { value: "30", label: "30 dni" },
  { value: "all", label: "Wszystkie" },
];

type RecentEntriesProps = {
  /** The stopped entries, newest first. */
  entries: TimeEntryResponse[];
  nowTick: number;
  taskTitles: ReadonlyMap<number, string>;
};

/** Ostatnie wpisy: the stopped entries of the chosen range; a tap edits one. */
export function RecentEntries({
  entries,
  nowTick,
  taskTitles,
}: RecentEntriesProps) {
  const [entryRange, setEntryRange] = useState<EntryRange>("today");

  const today = dateKey(new Date(nowTick));
  const recentEntries = entries.filter((entry) => {
    const key = dateKey(entry.start);
    if (entryRange === "today") return key === today;
    if (entryRange === "all") return true;
    return key >= daysAgoKey(nowTick, Number(entryRange) - 1);
  });

  return (
    <View className={card.section}>
      <View className="flex-row items-center justify-between">
        <Text className={card.title}>Ostatnie wpisy</Text>
        <Text className={card.kicker}>
          {recentEntries.length}{" "}
          {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
        </Text>
      </View>
      <ChipGroup options={RANGES} value={entryRange} onChange={setEntryRange} />
      {recentEntries.length === 0 ? (
        <Text className="py-2 text-xs text-muted">
          {entryRange === "today"
            ? "Brak wpisów na dziś."
            : "Brak wpisów w wybranym zakresie."}
        </Text>
      ) : (
        recentEntries.map((entry) => {
          const title = entryTitle(entry, taskTitles);
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj wpis: ${title}`}
              onPress={() =>
                router.push({
                  pathname: "/time-entry",
                  params: { entryId: entry.id },
                })
              }
              className="flex-row items-center gap-2.5 border-b border-row-line py-3"
            >
              <Text className="text-xs text-muted tabular-nums">
                {formatClock(entry.start)}–
                {entry.end ? formatClock(entry.end) : "…"}
              </Text>
              <Text
                className="flex-1 text-sm font-medium text-ink"
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text className="text-xs font-semibold text-muted">
                {formatDuration(entryMinutes(entry))}
              </Text>
            </Pressable>
          );
        })
      )}
      <View className={form.actions}>
        <Button
          label="+ Dodaj wpis ręcznie"
          variant="secondary"
          onPress={() => router.push("/time-entry")}
        />
      </View>
    </View>
  );
}
