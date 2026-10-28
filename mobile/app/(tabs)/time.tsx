import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { TIMER_LOAD_ERROR } from "@personal/shared/loadErrors";
import { defaultProject, useProjects } from "@personal/shared/queries/projects";
import { useAllTasks } from "@personal/shared/queries/tasks";
import {
  useDiscardTimer,
  useRefreshTimer,
  useStartTimer,
  useStopTimer,
  useTimeEntries,
  useTimer,
} from "@personal/shared/queries/timer";
import {
  dateKey,
  entryMinutes,
  formatClock,
  formatDuration,
  formatElapsed,
} from "@personal/shared/timeFormat";
import { timerLimitOptions, timerRemaining } from "@personal/shared/timerLimit";

import { Button } from "../../src/Button";
import { ChipGroup } from "../../src/ChipGroup";
import { TitleSuggestions } from "../../src/TitleSuggestions";
import { card, colors, common, form, fonts } from "../../src/theme";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

type EntryRange = "today" | "7" | "30" | "all";

/** The project chip for starting a timer with no project (project ids start at 1). */
const NO_PROJECT = 0;

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
  const { data: projects = [], refetch: refetchProjects } = useProjects();
  const timer = useTimer();
  const entriesQuery = useTimeEntries();
  const tasksQuery = useAllTasks();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const discardTimer = useDiscardTimer();
  const refreshTimer = useRefreshTimer();

  const runningEntryRaw = timer.data?.runningEntry ?? null;
  const serverOffset = timer.data?.serverOffset ?? 0;
  const entries = entriesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const isLoading =
    timer.isPending || entriesQuery.isPending || tasksQuery.isPending;
  const pageError =
    timer.isError || entriesQuery.isError || tasksQuery.isError
      ? TIMER_LOAD_ERROR
      : "";
  const [actionError, setActionError] = useState("");

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [startProjectId, setStartProjectId] = useState<number | null>(null);
  const [startTitle, setStartTitle] = useState("");
  /** Minutes, or 0 for a timer that runs until stopped. */
  const [startLimit, setStartLimit] = useState(0);
  const [startError, setStartError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [entryRange, setEntryRange] = useState<EntryRange>("today");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refetch: refetchTimer } = timer;
  const { refetch: refetchEntries } = entriesQuery;
  const { refetch: refetchTasks } = tasksQuery;
  const reload = useCallback(
    () =>
      Promise.all([
        refetchTimer(),
        refetchEntries(),
        refetchTasks(),
        refetchProjects(),
      ]),
    [refetchTimer, refetchEntries, refetchTasks, refetchProjects],
  );
  // Reload on every visit: the timer may have been changed on another device.
  useRefreshOnFocus(reload);

  const runningEntry =
    runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null;

  useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  // The server stops a limited timer by itself; fetch the new state just after
  // that moment (the extra second covers clock jitter).
  const plannedEndMs = runningEntry?.plannedEnd?.getTime() ?? null;
  useEffect(() => {
    if (plannedEndMs == null) return;
    const delay =
      Math.max(0, plannedEndMs - (Date.now() + serverOffset)) + 1000;
    const timeout = setTimeout(() => {
      refreshTimer().catch(async (error: unknown) =>
        setActionError(await apiErrorMessage(error)),
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [plannedEndMs, serverOffset, refreshTimer]);

  async function refresh() {
    setIsRefreshing(true);
    await reload();
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
      await startTimer.mutateAsync({
        title,
        durationMinutes: startLimit || undefined,
      });
      setStartTitle("");
      setNowTick(Date.now());
    } catch (error) {
      setStartError(await apiErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  /** Run a stop or discard, showing its failure under the timer. */
  async function run(action: () => Promise<unknown>) {
    setIsBusy(true);
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
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
  const todaysEntries = stoppedEntries.filter(
    (entry) => dateKey(entry.start) === today,
  );
  const todaysMinutes = todaysEntries.reduce(
    (sum, entry) => sum + entryMinutes(entry),
    0,
  );

  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const entryTitle = (entry: TimeEntryResponse) =>
    entry.title ||
    (entry.taskId != null
      ? (taskTitles.get(entry.taskId) ?? `Zadanie #${entry.taskId}`)
      : "Bez tytułu");

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
  for (const entry of stoppedEntries) {
    const key = dateKey(entry.start);
    if (minutesByDay.has(key))
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + entryMinutes(entry));
  }

  // Without a project the timer runs on its title alone; suggestions come from every project.
  const chosenProjectId =
    startProjectId ?? defaultProject(projects)?.id ?? null;
  const startTasks =
    chosenProjectId === NO_PROJECT
      ? tasks
      : tasks.filter((task) => task.projectId === chosenProjectId);

  if (pageError) {
    return (
      <View style={common.center}>
        <Text style={common.error}>{pageError}</Text>
        <Button
          label="Spróbuj ponownie"
          variant="secondary"
          onPress={() => void refresh()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={common.screen}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isLoading}
          onRefresh={() => void refresh()}
        />
      }
    >
      <View style={card.section}>
        {runningEntry ? (
          <>
            <Text style={[card.kicker, { color: colors.primary }]}>
              TIMER AKTYWNY
            </Text>
            <Text style={card.title}>{entryTitle(runningEntry)}</Text>
            <Text style={styles.elapsed}>
              {formatElapsed(
                timerRemaining(runningEntry, nowTick + serverOffset) ??
                  nowTick + serverOffset - runningEntry.start.getTime(),
              )}
            </Text>
            {runningEntry.plannedEnd && (
              <Text style={common.muted}>
                Pozostało · zatrzyma się o{" "}
                {formatClock(runningEntry.plannedEnd)}
              </Text>
            )}
            <View style={form.actions}>
              <Button
                label="Zatrzymaj"
                isBusy={isBusy}
                onPress={() => void run(() => stopTimer.mutateAsync())}
              />
              <Button
                label="Odrzuć"
                variant="secondary"
                disabled={isBusy}
                onPress={() =>
                  void run(() => discardTimer.mutateAsync(runningEntry))
                }
              />
            </View>
          </>
        ) : (
          <>
            <Text style={card.kicker}>BRAK AKTYWNEGO TIMERA</Text>
            <Text style={form.label}>Projekt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChipGroup
                options={[
                  { value: NO_PROJECT, label: "Bez projektu" },
                  ...projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
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
            <TitleSuggestions
              tasks={startTasks}
              query={startTitle}
              onPick={setStartTitle}
            />
            <Text style={form.label}>Limit czasu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChipGroup
                options={[
                  { value: 0, label: "Bez limitu" },
                  ...timerLimitOptions.map((option) => ({
                    value: option.minutes,
                    label: option.label,
                  })),
                ]}
                value={startLimit}
                onChange={setStartLimit}
                nowrap
              />
            </ScrollView>
            {startError !== "" && <Text style={form.error}>{startError}</Text>}
            <View style={form.actions}>
              <Button
                label="Rozpocznij timer"
                isBusy={isBusy}
                onPress={() => void start()}
              />
            </View>
          </>
        )}
        {actionError !== "" && <Text style={form.error}>{actionError}</Text>}
      </View>

      <View style={card.section}>
        <View style={styles.sectionHeader}>
          <Text style={card.title}>Ostatnie wpisy</Text>
          <Text style={card.kicker}>
            {recentEntries.length}{" "}
            {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
          </Text>
        </View>
        <ChipGroup
          options={RANGES}
          value={entryRange}
          onChange={setEntryRange}
        />
        {recentEntries.length === 0 ? (
          <Text style={[common.muted, { paddingVertical: 8 }]}>
            {entryRange === "today"
              ? "Brak wpisów na dziś."
              : "Brak wpisów w wybranym zakresie."}
          </Text>
        ) : (
          recentEntries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj wpis: ${entryTitle(entry)}`}
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
                {entryTitle(entry)}
              </Text>
              <Text style={styles.entryDuration}>
                {formatDuration(entryMinutes(entry))}
              </Text>
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

        <Text style={[card.kicker, { marginTop: 8 }]}>
          WEDŁUG ZADANIA (DZIŚ)
        </Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  elapsed: {
    fontFamily: fonts.utility,
    fontSize: 36,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
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
  entryTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500" },
  entryDuration: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  total: {
    fontFamily: fonts.utility,
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { flex: 1, color: colors.text },
});
