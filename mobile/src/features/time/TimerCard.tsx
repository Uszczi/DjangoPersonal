import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { defaultProject } from "@personal/shared/queries/projects";
import {
  useDiscardTimer,
  useRefreshTimer,
  useStartTimer,
  useStopTimer,
} from "@personal/shared/queries/timer";
import { formatClock, formatElapsed } from "@personal/shared/timeFormat";
import { timerLimitOptions, timerRemaining } from "@personal/shared/timerLimit";

import { fonts, makeStyles, useTheme } from "../../theme";
import { Button } from "../../ui/Button";
import { ChipGroup } from "../../ui/ChipGroup";
import { TitleSuggestions } from "../tasks/TitleSuggestions";
import { entryTitle } from "./entryDays";

/** The project chip for starting a timer with no project (project ids start at 1). */
const NO_PROJECT = 0;

type TimerCardProps = {
  /** The running entry, or null when no timer runs. */
  runningEntry: TimeEntryResponse | null;
  /** Server time minus device time, in ms. */
  serverOffset: number;
  nowTick: number;
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  taskTitles: ReadonlyMap<number, string>;
  /** Called once a timer has started, so the clock restarts from now. */
  onStarted: () => void;
};

/** The running timer with Zatrzymaj/Odrzuć, or the form that starts one. */
export function TimerCard({
  runningEntry,
  serverOffset,
  nowTick,
  projects,
  tasks,
  taskTitles,
  onStarted,
}: TimerCardProps) {
  const { colors, common, card, form } = useTheme();
  const styles = useStyles();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const discardTimer = useDiscardTimer();
  const refreshTimer = useRefreshTimer();

  const [startProjectId, setStartProjectId] = useState<number | null>(null);
  const [startTitle, setStartTitle] = useState("");
  /** Minutes, or 0 for a timer that runs until stopped. */
  const [startLimit, setStartLimit] = useState(0);
  const [startError, setStartError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

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
      onStarted();
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

  // Without a project the timer runs on its title alone; suggestions come from every project.
  const chosenProjectId =
    startProjectId ?? defaultProject(projects)?.id ?? null;
  const startTasks =
    chosenProjectId === NO_PROJECT
      ? tasks
      : tasks.filter((task) => task.projectId === chosenProjectId);

  return (
    <View style={card.section}>
      {runningEntry ? (
        <>
          <Text style={[card.kicker, { color: colors.signal }]}>
            TIMER AKTYWNY
          </Text>
          <Text style={card.title}>{entryTitle(runningEntry, taskTitles)}</Text>
          <Text style={styles.elapsed}>
            {formatElapsed(
              timerRemaining(runningEntry, nowTick + serverOffset) ??
                nowTick + serverOffset - runningEntry.start.getTime(),
            )}
          </Text>
          {runningEntry.plannedEnd && (
            <Text style={common.muted}>
              Pozostało · zatrzyma się o {formatClock(runningEntry.plannedEnd)}
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
  );
}

const useStyles = makeStyles((colors) => ({
  elapsed: {
    fontFamily: fonts.utility,
    fontSize: 36,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
}));
