import { onlineManager } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { TIMER_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";
import { useAllTasks } from "@personal/shared/queries/tasks";
import { useTimeEntries, useTimer } from "@personal/shared/queries/timer";
import { shortTaskTitle } from "@personal/shared/taskTitle";

import { TimeLog } from "@/features/time/TimeLog";
import { TimerCard } from "@/features/time/TimerCard";
import { TimeStats } from "@/features/time/TimeStats";
import { WeekStrip } from "@/features/time/WeekStrip";
import { common } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";

type TimeView = "log" | "stats";

const VIEWS: { value: TimeView; label: string }[] = [
  { value: "log", label: "Dziennik" },
  { value: "stats", label: "Statystyki" },
];
import { useRefreshOnFocus } from "@/useRefreshOnFocus";

/**
 * The web Czas page: the Dziennik (the running timer, the last seven days and
 * the entries by day) or the Statystyki.
 */
export default function TimeScreen() {
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
  const [view, setView] = useState<TimeView>("log");

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
    // Offline the refetches would wait for a connection, and the spinner with them.
    if (onlineManager.isOnline()) await reload();
    setNowTick(Date.now());
    setIsRefreshing(false);
  }

  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const taskTitles = new Map(
    tasks.map((task) => [task.id, shortTaskTitle(task.title)]),
  );

  if (pageError) {
    return (
      <View className={common.center}>
        <Text className={common.error}>{pageError}</Text>
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
      className={common.screen}
      contentContainerClassName="pb-8"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isLoading}
          onRefresh={() => void refresh()}
        />
      }
    >
      <View className="mx-4 mt-4">
        <ChipGroup options={VIEWS} value={view} onChange={setView} />
      </View>
      {view === "stats" ? (
        <TimeStats
          entries={stoppedEntries}
          tasks={tasks}
          projects={projects}
          nowTick={nowTick}
        />
      ) : (
        <>
          <TimerCard
            runningEntry={runningEntry}
            serverOffset={serverOffset}
            nowTick={nowTick}
            projects={projects}
            tasks={tasks}
            taskTitles={taskTitles}
            onStarted={() => setNowTick(Date.now())}
          />
          <WeekStrip entries={stoppedEntries} nowTick={nowTick} />
          <TimeLog
            entries={stoppedEntries}
            nowTick={nowTick}
            tasks={tasks}
            projects={projects}
            taskTitles={taskTitles}
            onStarted={() => setNowTick(Date.now())}
          />
        </>
      )}
    </ScrollView>
  );
}
