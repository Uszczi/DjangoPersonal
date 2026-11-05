import { Play, Square } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { backlogLabel } from "@personal/shared/queries/outbox";
import {
  useDiscardTimer,
  useRefreshTimer,
  useStartTimer,
  useStopTimer,
  useTimerBacklog,
} from "@personal/shared/queries/timer";
import { useOutboxErrorsStore } from "@personal/shared/stores/outboxErrors";
import { formatClock, formatElapsed } from "@personal/shared/timeFormat";
import { timerLimitOptions, timerRemaining } from "@personal/shared/timerLimit";
import { Button, Select } from "@/design-system";
import {
  askForTimerNotifications,
  notifyTimerFinished,
} from "@/lib/timerNotification";

import { NO_PROJECT, ProjectSelect } from "./ProjectSelect";
import { TaskTitleInput } from "./TaskTitleInput";

const roundButton =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 text-on-signal transition-colors disabled:cursor-wait disabled:opacity-70";

/**
 * The Running timer as one bar that stays at the top of the Dziennik: the
 * title, the clock and Zatrzymaj/Odrzuć while it runs, else the title field
 * with the project (which narrows the suggestions) and an optional limit.
 */
export function TimerBar({
  runningEntry,
  runningTitle,
  now,
  serverOffset,
  projects,
  tasks,
  defaultProjectId,
  onActionError,
}: {
  runningEntry: TimeEntryResponse | null;
  runningTitle: string;
  /** Current time corrected by the server offset, in ms. */
  now: number;
  /** Server clock minus this device's, in ms. */
  serverOffset: number;
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
  /** Shows a failed stop, discard or refresh ("" clears it). */
  onActionError: (message: string) => void;
}) {
  const stopTimer = useStopTimer();
  const discardTimer = useDiscardTimer();
  const refreshTimer = useRefreshTimer();
  const backlog = useTimerBacklog();
  const lateError = useOutboxErrorsStore((state) => state.message);
  const dismissLateError = useOutboxErrorsStore((state) => state.dismiss);

  const plannedEnd = runningEntry?.plannedEnd ?? null;
  const plannedEndMs = plannedEnd?.getTime() ?? null;
  const entryId = runningEntry?.id ?? null;
  /** Title of the limited timer that just ran out, shown until the next start. */
  const [finishedTitle, setFinishedTitle] = useState<string | null>(null);

  // The server stops a limited timer by itself; fetch the new state just after
  // that moment (the extra second covers clock jitter) and, if it did end on
  // its limit (not stopped early elsewhere), tell the user.
  useEffect(() => {
    if (plannedEndMs == null || entryId == null) return;
    const delay =
      Math.max(0, plannedEndMs - (Date.now() + serverOffset)) + 1000;
    const timeout = setTimeout(async () => {
      let fresh;
      try {
        fresh = await refreshTimer();
      } catch (error) {
        onActionError(await apiErrorMessage(error));
        return;
      }
      const entry = fresh.entries.find((item) => item.id === entryId);
      if (
        fresh.timer.runningEntry?.id !== entryId &&
        entry?.end?.getTime() === plannedEndMs
      ) {
        setFinishedTitle(runningTitle);
        notifyTimerFinished(runningTitle);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [
    plannedEndMs,
    entryId,
    runningTitle,
    serverOffset,
    refreshTimer,
    onActionError,
  ]);

  /** Run a stop or discard, showing its failure under the entries. */
  async function act(action: () => Promise<unknown>) {
    onActionError("");
    dismissLateError();
    try {
      await action();
    } catch (error) {
      onActionError(await apiErrorMessage(error));
    }
  }

  const remaining = runningEntry ? timerRemaining(runningEntry, now) : null;
  const limitTotal =
    runningEntry && plannedEnd
      ? plannedEnd.getTime() - runningEntry.start.getTime()
      : null;

  return (
    <section
      aria-label="Bieżący timer"
      className="sticky top-2 z-10 mb-5 overflow-hidden rounded-[7px] border border-card-line bg-paper shadow-[0_14px_35px_rgb(29_55_57/8%)]"
    >
      {runningEntry ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 pl-4 sm:flex-nowrap sm:pl-5">
          <div className="flex min-w-0 basis-full items-center gap-2.5 sm:basis-0 sm:flex-1">
            <span
              className="size-2.5 shrink-0 animate-pulse rounded-full bg-signal"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 truncate font-display text-[17px] font-bold text-ink">
              {runningTitle}
            </p>
            <span className="shrink-0 text-[13px] text-muted">
              {plannedEnd
                ? `Pozostało · zatrzyma się o ${formatClock(plannedEnd)}`
                : `od ${formatClock(runningEntry.start)}`}
            </span>
          </div>
          <span className="mr-auto font-utility text-[22px] font-bold tabular-nums text-ink sm:mr-0 sm:min-w-[110px] sm:text-right">
            {formatElapsed(remaining ?? now - runningEntry.start.getTime())}
          </span>
          <Button
            variant="ghost"
            aria-label="Odrzuć timer"
            onClick={() =>
              void act(() => discardTimer.mutateAsync(runningEntry))
            }
          >
            Odrzuć
          </Button>
          <button
            type="button"
            aria-label="Zatrzymaj timer"
            title="Zatrzymaj timer"
            className={`${roundButton} bg-signal hover:bg-signal-strong`}
            disabled={stopTimer.isPending}
            onClick={() => void act(() => stopTimer.mutateAsync())}
          >
            <Square size={16} fill="currentColor" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <StartTimerRow
          projects={projects}
          tasks={tasks}
          defaultProjectId={defaultProjectId}
          finishedTitle={finishedTitle}
          onStart={() => {
            setFinishedTitle(null);
            dismissLateError();
          }}
        />
      )}
      {(backlog > 0 || lateError !== null) && (
        <div
          role="status"
          className="flex flex-wrap gap-x-3 border-t border-line-soft px-4 py-2 text-[13px] sm:px-5"
        >
          {backlog > 0 && (
            <span className="text-muted">
              Offline · {backlogLabel(backlog)}
            </span>
          )}
          {lateError !== null && (
            <span className="text-danger">{lateError}</span>
          )}
        </div>
      )}
      {remaining != null && limitTotal != null && limitTotal > 0 && (
        <div className="h-1 bg-line-soft" aria-hidden="true">
          <div
            className="h-full bg-signal transition-[width]"
            style={{ width: `${(1 - remaining / limitTotal) * 100}%` }}
          />
        </div>
      )}
    </section>
  );
}

function StartTimerRow({
  projects,
  tasks,
  defaultProjectId,
  finishedTitle,
  onStart,
}: {
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
  finishedTitle: string | null;
  onStart: () => void;
}) {
  const startTimer = useStartTimer();
  const [form, setForm] = useState({ projectId: "", title: "" });
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  const projectId = form.projectId || defaultProjectId;
  // Without a project the timer still runs on its title; suggest every task's title.
  const suggestions = [
    ...new Set(
      tasks
        .filter(
          (task) => projectId === NO_PROJECT || task.projectId === projectId,
        )
        .map((task) => task.title),
    ),
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("Podaj tytuł zadania.");
      return;
    }
    setError("");
    if (limit) askForTimerNotifications();
    onStart();
    try {
      await startTimer.mutateAsync({
        title,
        durationMinutes: limit ? Number(limit) : undefined,
      });
      setForm((current) => ({ ...current, title: "" }));
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <div className="p-3 sm:pl-5">
      {finishedTitle && (
        <p
          className="mb-3 rounded border border-accent bg-wash px-3 py-2 text-[14px] font-semibold text-ink"
          role="status"
        >
          Czas minął: {finishedTitle}
        </p>
      )}
      <form
        className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3"
        onSubmit={submit}
      >
        <label className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <span className="sr-only">Zadanie</span>
          <TaskTitleInput
            suggestions={suggestions}
            value={form.title}
            placeholder="Nad czym teraz pracujesz?"
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
        </label>
        <label className="min-w-0 flex-1 sm:w-44 sm:flex-none">
          <span className="sr-only">Projekt</span>
          <ProjectSelect
            projects={projects}
            value={projectId}
            onChange={(id) => setForm({ projectId: id, title: "" })}
            allowNone
          />
        </label>
        <label className="min-w-0 flex-1 sm:w-36 sm:flex-none">
          <span className="sr-only">Limit czasu</span>
          <Select
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          >
            <option value="">Bez limitu</option>
            {timerLimitOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <button
          type="submit"
          aria-label="Rozpocznij timer"
          title="Rozpocznij timer"
          className={`${roundButton} bg-accent hover:bg-ink-soft`}
          disabled={startTimer.isPending}
        >
          <Play size={18} fill="currentColor" aria-hidden="true" />
        </button>
      </form>
      {error && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
