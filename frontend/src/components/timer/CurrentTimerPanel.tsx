import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { useTimerStore } from "@personal/shared/stores/timer";
import { formatElapsed } from "@personal/shared/timeFormat";
import { Button } from "@/design-system";

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

  return (
    <TimerPanel label="Bieżący timer">
      {runningEntry ? (
        <>
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-signal">
            TIMER AKTYWNY
          </p>
          <p className="mt-1 font-display text-[20px] font-bold text-ink">{runningTitle}</p>
          <p className="mt-2 font-utility text-[36px] font-bold tracking-tight text-ink">
            {formatElapsed(now - runningEntry.start.getTime())}
          </p>
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
        <StartTimerForm projects={projects} tasks={tasks} defaultProjectId={defaultProjectId} />
      )}
    </TimerPanel>
  );
}

function StartTimerForm({ projects, tasks, defaultProjectId }: {
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
}) {
  const startTimer = useTimerStore((state) => state.startTimer);
  const [form, setForm] = useState({ projectId: "", title: "" });
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
    try {
      await startTimer(title);
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
