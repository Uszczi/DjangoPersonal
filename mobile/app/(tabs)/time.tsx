import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { defaultProject, useProjectsStore } from "@personal/shared/stores/projects";
import { useTimerStore } from "@personal/shared/stores/timer";
import {
  dateKey,
  entryMinutes,
  formatClock,
  formatDuration,
  formatElapsed,
} from "@personal/shared/timeFormat";

import { Button } from "../../src/Button";
import { ChipGroup } from "../../src/ChipGroup";
import { TitleSuggestions } from "../../src/TitleSuggestions";
import { card, colors, common, form } from "../../src/theme";

type EntryRange = "today" | "7" | "30" | "all";

const RANGES: { value: EntryRange; label: string }[] = [
  { value: "today", label: "Dziś" },
  { value: "7", label: "7 dni" },
  { value: "30", label: "30 dni" },
  { value: "all", label: "Wszystkie" },
];

function daysAgoKey(now: number, days: number) {
  const day = new Date(now);
  day.setDate(day.getDate() - days);
  return dateKey(day);
}

/** The web Timer page: the running timer, recent entries and the time summary. */
export default function TimeScreen() {
  const projects = useProjectsStore((state) => state.projects);
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const isLoading = useTimerStore((state) => state.isLoading);
  const pageError = useTimerStore((state) => state.pageError);
  const runningEntryRaw = useTimerStore((state) => state.runningEntry);
  const serverOffset = useTimerStore((state) => state.serverOffset);
  const entries = useTimerStore((state) => state.entries);
  const tasks = useTimerStore((state) => state.tasks);
  const actionError = useTimerStore((state) => state.actionError);
  const loadData = useTimerStore((state) => state.loadData);
  const startTimer = useTimerStore((state) => state.startTimer);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const discardTimer = useTimerStore((state) => state.discardTimer);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [startProjectId, setStartProjectId] = useState<number | null>(null);
  const [startTitle, setStartTitle] = useState("");
  const [startError, setStartError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [entryRange, setEntryRange] = useState<EntryRange>("today");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reload on every visit: a timer may have been started from a Task meanwhile.
  useFocusEffect(
    useCallback(() => {
      void loadData();
      void loadProjects();
    }, [loadData, loadProjects]),
  );

  const runningEntry = runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null;

  useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  async function refresh() {
    setIsRefreshing(true);
    await loadData();
    setNowTick(Date.now());
    setIsRefreshing(false);
  }

  async function start() {
    const title = startTitle.trim();
    if (!title) {
      setStartError("Podaj tytuł zadania.");
      return;
    }
    setStartError("");
    setIsBusy(true);
    try {
      await startTimer(title);
      setStartTitle("");
      setNowTick(Date.now());
    } catch (error) {
      setStartError(await apiErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    await action();
    setIsBusy(false);
  }

  const today = dateKey(new Date(nowTick));
  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const recentEntries = stoppedEntries.filter((entry) => {
    const key = dateKey(entry.start);
    if (entryRange === "today") return key === today;
    if (entryRange === "all") return true;
    return key >= daysAgoKey(nowTick, Number(entryRange) - 1);
  });
  const todaysEntries = stoppedEntries.filter((entry) => dateKey(entry.start) === today);
  const todaysMinutes = todaysEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0);

  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const entryTitle = (entry: TimeEntryResponse) =>
    entry.title ||
    (entry.taskId != null
      ? (taskTitles.get(entry.taskId) ?? `Zadanie #${entry.taskId}`)
      : "Bez tytułu");

  const perTaskMinutes = new Map<number, number>();
  for (const entry of todaysEntries) {
    if (entry.taskId == null) continue;
    perTaskMinutes.set(entry.taskId, (perTaskMinutes.get(entry.taskId) ?? 0) + entryMinutes(entry));
  }
  const dayKeys = Array.from({ length: 7 }, (_, index) => daysAgoKey(nowTick, 6 - index));
  const minutesByDay = new Map(dayKeys.map((key) => [key, 0]));
  for (const entry of stoppedEntries) {
    const key = dateKey(entry.start);
    if (minutesByDay.has(key)) minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + entryMinutes(entry));
  }

  const chosenProjectId = startProjectId ?? defaultProject(projects)?.id ?? null;
  const startTasks = tasks.filter((task) => task.projectId === chosenProjectId);

  if (pageError) {
    return (
      <View style={common.center}>
        <Text style={common.error}>{pageError}</Text>
        <Button label="Spróbuj ponownie" variant="secondary" onPress={() => void refresh()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={common.screen}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefreshing || isLoading} onRefresh={() => void refresh()} />
      }
    >
      <View style={card.section}>
        {runningEntry ? (
          <>
            <Text style={[card.kicker, { color: colors.success }]}>TIMER AKTYWNY</Text>
            <Text style={card.title}>{entryTitle(runningEntry)}</Text>
            <Text style={styles.elapsed}>
              {formatElapsed(nowTick + serverOffset - runningEntry.start.getTime())}
            </Text>
            <View style={form.actions}>
              <Button label="Zatrzymaj" isBusy={isBusy} onPress={() => void run(stopTimer)} />
              <Button
                label="Odrzuć"
                variant="secondary"
                disabled={isBusy}
                onPress={() => void run(discardTimer)}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={card.kicker}>BRAK AKTYWNEGO TIMERA</Text>
            <Text style={form.label}>Projekt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChipGroup
                options={projects.map((project) => ({ value: project.id, label: project.name }))}
                value={chosenProjectId ?? undefined}
                onChange={(projectId) => {
                  setStartProjectId(projectId);
                  setStartTitle("");
                }}
                nowrap
              />
            </ScrollView>
            <Text style={form.label}>Zadanie</Text>
            <TextInput
              style={form.input}
              value={startTitle}
              onChangeText={setStartTitle}
              placeholder="Tytuł zadania"
              returnKeyType="go"
              onSubmitEditing={() => void start()}
            />
            <TitleSuggestions tasks={startTasks} query={startTitle} onPick={setStartTitle} />
            {startError !== "" && <Text style={form.error}>{startError}</Text>}
            <View style={form.actions}>
              <Button label="Rozpocznij timer" isBusy={isBusy} onPress={() => void start()} />
            </View>
          </>
        )}
        {actionError !== "" && <Text style={form.error}>{actionError}</Text>}
      </View>

      <View style={card.section}>
        <View style={styles.sectionHeader}>
          <Text style={card.title}>Ostatnie wpisy</Text>
          <Text style={card.kicker}>
            {recentEntries.length} {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
          </Text>
        </View>
        <ChipGroup options={RANGES} value={entryRange} onChange={setEntryRange} />
        {recentEntries.length === 0 ? (
          <Text style={[common.muted, { paddingVertical: 8 }]}>
            {entryRange === "today" ? "Brak wpisów na dziś." : "Brak wpisów w wybranym zakresie."}
          </Text>
        ) : (
          recentEntries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj wpis: ${entryTitle(entry)}`}
              onPress={() =>
                router.push({ pathname: "/time-entry", params: { entryId: entry.id } })
              }
              style={styles.entryRow}
            >
              <Text style={styles.entryClock}>
                {formatClock(entry.start)}–{entry.end ? formatClock(entry.end) : "…"}
              </Text>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {entryTitle(entry)}
              </Text>
              <Text style={styles.entryDuration}>{formatDuration(entryMinutes(entry))}</Text>
            </Pressable>
          ))
        )}
        <View style={form.actions}>
          <Button
            label="+ Dodaj wpis ręcznie"
            variant="secondary"
            onPress={() => router.push("/time-entry")}
          />
        </View>
      </View>

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
            <Text style={common.muted}>{formatDuration(minutesByDay.get(key) ?? 0)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  elapsed: {
    fontSize: 40,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryClock: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  entryTitle: { flex: 1, color: colors.text, fontSize: 15 },
  entryDuration: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  total: { fontSize: 24, fontWeight: "700", color: colors.text },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { flex: 1, color: colors.text },
});
