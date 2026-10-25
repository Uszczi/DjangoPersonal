import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { useTimerStore } from "@personal/shared/stores/timer";
import { formatClock, formatElapsed } from "@personal/shared/timeFormat";
import { timerLimitOptions, timerRemaining } from "@personal/shared/timerLimit";
import { Button, Select } from "@/design-system";
import { askForTimerNotifications, notifyTimerFinished } from "@/lib/timerNotification";

import { ProjectSelect } from "./ProjectSelect";
import { TaskTitleInput } from "./TaskTitleInput";
import { FormLabel, TimerPanel } from "./TimerPanel";

export function CurrentTimerPanel({ runningEntry, runningTitle, now, projects, tasks, defaultProjectId }: {
  runningEntry: TimeEntryResponse | null;
  runningTitle: string;
  /** Current time corrected by the server offset, in ms. */
  now: number;
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
}) {
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const discardTimer = useTimerStore((state) => state.discardTimer);
  const refreshTimer = useTimerStore((state) => state.refreshTimer);
  const serverOffset = useTimerStore((state) => state.serverOffset);

  const remaining = runningEntry ? timerRemaining(runningEntry, now) : null;
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
    const delay = Math.max(0, plannedEndMs - (Date.now() + serverOffset)) + 1000;
    const timeout = setTimeout(async () => {
      await refreshTimer();
      const state = useTimerStore.getState();
      const entry = state.entries.find((item) => item.id === entryId);
      if (state.runningEntry?.id !== entryId && entry?.end?.getTime() === plannedEndMs) {
        setFinishedTitle(runningTitle);
        notifyTimerFinished(runningTitle);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [plannedEndMs, entryId, runningTitle, serverOffset, refreshTimer]);

  return (
    <TimerPanel label="Bieżący timer">
      {runningEntry ? (
        <>
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-signal">
            TIMER AKTYWNY
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-ink">{runningTitle}</p>
          <p className="mt-2 font-utility text-[36px] font-bold tracking-tight text-ink">
            {formatElapsed(remaining ?? now - runningEntry.start.getTime())}
          </p>
          {plannedEnd && (
            <p className="text-[13px] text-muted">
              Pozostało · zatrzyma się o {formatClock(plannedEnd)}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" onClick={() => void stopTimer()}>
              Zatrzymaj timer
            </Button>
            <Button variant="secondary" onClick={() => void discardTimer()}>
              Odrzuć timer
            </Button>
          </div>
        </>
      ) : (
        <>
          {finishedTitle && (
            <p
              className="mb-4 rounded border border-signal bg-signal-pale px-3 py-2 text-[14px] font-semibold text-ink"
              role="status"
            >
              Czas minął: {finishedTitle}
            </p>
          )}
          <StartTimerForm
            projects={projects}
            tasks={tasks}
            defaultProjectId={defaultProjectId}
            onStart={() => setFinishedTitle(null)}
          />
        </>
      )}
    </TimerPanel>
  );
}

function StartTimerForm({ projects, tasks, defaultProjectId, onStart }: {
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
  onStart: () => void;
}) {
  const startTimer = useTimerStore((state) => state.startTimer);
  const [form, setForm] = useState({ projectId: "", title: "" });
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  const projectId = form.projectId || defaultProjectId;
  const suggestions = tasks
    .filter((task) => task.projectId === Number(projectId))
    .map((task) => task.title);

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
      await startTimer(title, limit ? Number(limit) : undefined);
      setForm((current) => ({ ...current, title: "" }));
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <>
      <p className="mb-4 text-[14px] text-muted">
        Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <FormLabel text="Projekt">
          <ProjectSelect
            projects={projects}
            value={projectId}
            onChange={(id) => setForm({ projectId: id, title: "" })}
          />
        </FormLabel>
        <FormLabel text="Zadanie">
          <TaskTitleInput
            suggestions={suggestions}
            value={form.title}
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
        </FormLabel>
        <FormLabel text="Limit czasu">
          <Select value={limit} onChange={(event) => setLimit(event.target.value)}>
            <option value="">Bez limitu</option>
            {timerLimitOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormLabel>
        <Button variant="primary" type="submit">
          Rozpocznij timer
        </Button>
      </form>
      {error && (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
