import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import { useTimerStore } from "@personal/shared/stores/timer";
import { todayKey } from "@personal/shared/timeFormat";
import { Button, TextInput } from "@/design-system";

import { parseEntryForm } from "./entries";
import { ProjectSelect } from "./ProjectSelect";
import { TaskTitleInput } from "./TaskTitleInput";
import { FormLabel, TimerPanel } from "./TimerPanel";

export function ManualEntryPanel({
  projects,
  tasks,
  defaultProjectId,
}: {
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
}) {
  const addManualEntry = useTimerStore((state) => state.addManualEntry);
  const [form, setForm] = useState({
    date: todayKey(),
    projectId: "",
    title: "",
    minutes: "",
  });
  const [error, setError] = useState("");

  const projectId = form.projectId || defaultProjectId;
  const suggestions = tasks
    .filter((task) => task.projectId === Number(projectId))
    .map((task) => task.title);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseEntryForm(form);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError("");
    try {
      await addManualEntry(parsed.input);
      setForm((current) => ({
        date: todayKey(),
        projectId: current.projectId,
        title: "",
        minutes: "",
      }));
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <TimerPanel title="Dodaj wpis ręcznie" headingId="manual-entry-heading">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <FormLabel text="Data">
          <TextInput
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
            required
          />
        </FormLabel>
        <FormLabel text="Projekt">
          <ProjectSelect
            projects={projects}
            value={projectId}
            onChange={(id) =>
              setForm((current) => ({ ...current, projectId: id, title: "" }))
            }
          />
        </FormLabel>
        <FormLabel text="Zadanie">
          <TaskTitleInput
            suggestions={suggestions}
            value={form.title}
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
        </FormLabel>
        <FormLabel text="Czas (minuty)">
          <TextInput
            type="number"
            min={1}
            max={1440}
            value={form.minutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                minutes: event.target.value,
              }))
            }
            required
          />
        </FormLabel>
        <Button variant="primary" type="submit">
          Dodaj wpis
        </Button>
      </form>
      {error && (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
    </TimerPanel>
  );
}
