import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { TIMER_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";
import { useAllTasks } from "@personal/shared/queries/tasks";
import { useTimeEntries, useTimer } from "@personal/shared/queries/timer";

import { RecentEntries } from "../../src/features/time/RecentEntries";
import { TimerCard } from "../../src/features/time/TimerCard";
import { TimeSummary } from "../../src/features/time/TimeSummary";
import { useTheme } from "../../src/theme";
import { Button } from "../../src/ui/Button";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

/** The web Timer page: the running timer, recent entries and the time summary. */
export default function TimeScreen() {
  const { common } = useTheme();
  const { data: projects = [], refetch: refetchProjects } = useProjects();
  const timer = useTimer();
  const entriesQuery = useTimeEntries();
  const tasksQuery = useAllTasks();

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

  const [nowTick, setNowTick] = useState(() => Date.now());
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

  async function refresh() {
    setIsRefreshing(true);
    await reload();
    setNowTick(Date.now());
    setIsRefreshing(false);
  }

  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));

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
      <TimerCard
        runningEntry={runningEntry}
        serverOffset={serverOffset}
        nowTick={nowTick}
        projects={projects}
        tasks={tasks}
        taskTitles={taskTitles}
        onStarted={() => setNowTick(Date.now())}
      />
      <RecentEntries
        entries={stoppedEntries}
        nowTick={nowTick}
        taskTitles={taskTitles}
      />
      <TimeSummary
        entries={stoppedEntries}
        nowTick={nowTick}
        taskTitles={taskTitles}
      />
    </ScrollView>
  );
}
