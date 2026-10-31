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

import { makeStyles, useTheme } from "../../theme";
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
  const { common, card, form } = useTheme();
  const styles = useStyles();
  const [entryRange, setEntryRange] = useState<EntryRange>("today");

  const today = dateKey(new Date(nowTick));
  const recentEntries = entries.filter((entry) => {
    const key = dateKey(entry.start);
    if (entryRange === "today") return key === today;
    if (entryRange === "all") return true;
    return key >= daysAgoKey(nowTick, Number(entryRange) - 1);
  });

  return (
    <View style={card.section}>
      <View style={styles.sectionHeader}>
        <Text style={card.title}>Ostatnie wpisy</Text>
        <Text style={card.kicker}>
          {recentEntries.length}{" "}
          {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
        </Text>
      </View>
      <ChipGroup options={RANGES} value={entryRange} onChange={setEntryRange} />
      {recentEntries.length === 0 ? (
        <Text style={[common.muted, { paddingVertical: 8 }]}>
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
              style={styles.entryRow}
            >
              <Text style={styles.entryClock}>
                {formatClock(entry.start)}–
                {entry.end ? formatClock(entry.end) : "…"}
              </Text>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.entryDuration}>
                {formatDuration(entryMinutes(entry))}
              </Text>
            </Pressable>
          );
        })
      )}
      <View style={form.actions}>
        <Button
          label="+ Dodaj wpis ręcznie"
          variant="secondary"
          onPress={() => router.push("/time-entry")}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  entryClock: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  entryTitle: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "500" },
  entryDuration: { color: colors.muted, fontSize: 12, fontWeight: "600" },
}));
