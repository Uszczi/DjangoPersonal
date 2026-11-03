import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import { useAddManualEntry } from "@personal/shared/queries/timer";
import { todayKey } from "@personal/shared/timeFormat";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";

import { parseEntryForm } from "./entries";
import { ProjectSelect } from "./ProjectSelect";
import { TaskTitleInput } from "./TaskTitleInput";

/** Logs time that was not tracked with the timer: a day, a title and minutes. */
export function ManualEntryModal({
  projects,
  tasks,
  defaultProjectId,
  onClose: close,
}: {
  projects: ProjectResponse[];
  tasks: TaskResponse[];
  defaultProjectId: string;
  onClose: () => void;
}) {
  const addManualEntry = useAddManualEntry();
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
      await addManualEntry.mutateAsync(parsed.input);
      close();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <Modal
      kicker="NOWY WPIS"
      title="Dodaj wpis ręcznie"
      titleId="manual-entry-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={submit}>
        <Field label="Data">
          <TextInput
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Projekt">
          <ProjectSelect
            projects={projects}
            value={projectId}
            onChange={(id) =>
              setForm((current) => ({ ...current, projectId: id, title: "" }))
            }
          />
        </Field>
        <Field label="Zadanie">
          <TaskTitleInput
            suggestions={suggestions}
            value={form.title}
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
        </Field>
        <Field label="Czas (minuty)">
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
        </Field>
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <ModalFooter>
          <Button variant="secondary" onClick={close}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={addManualEntry.isPending}
          >
            Dodaj wpis
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
