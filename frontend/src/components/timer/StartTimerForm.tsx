import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { ProjectResponse, TaskResponse } from "@personal/shared/generated/api";
import { useTimerStore } from "@personal/shared/stores/timer";
import { timerLimitOptions } from "@personal/shared/timerLimit";
import { Button, Select } from "@/design-system";
import { askForTimerNotifications } from "@/lib/timerNotification";

import { NO_PROJECT, ProjectSelect } from "./ProjectSelect";
import { TaskTitleInput } from "./TaskTitleInput";
import { FormLabel } from "./TimerPanel";

/** Starts a timer on a title, optionally with a project and a limit; shown while no timer runs. */
export function StartTimerForm({ projects, tasks, defaultProjectId, onStart }: {
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
  // Without a project the timer still runs on its title; suggest every task's title.
  const suggestions = [
    ...new Set(
      tasks
        .filter((task) => projectId === NO_PROJECT || task.projectId === Number(projectId))
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
            allowNone
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
