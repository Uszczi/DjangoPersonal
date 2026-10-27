import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { useDeleteEntry, useUpdateEntry } from "@personal/shared/queries/timer";
import { dateKey, entryMinutes } from "@personal/shared/timeFormat";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";

import {
  parseEntryForm,
  type EntryFormValues,
  type TaskTitles,
} from "./entries";
import { TaskTitleInput } from "./TaskTitleInput";

/** Shows a Time entry read-only until "Edytuj"; mount with `key={entry.id}` so each entry starts fresh. */
export function EntryEditorModal({
  entry,
  tasks,
  taskTitles,
  onClose: close,
  onActionError,
}: {
  entry: TimeEntryResponse;
  tasks: TaskResponse[];
  taskTitles: TaskTitles;
  onClose: () => void;
  /** Shows a failed delete, which runs after the modal has closed. */
  onActionError: (message: string) => void;
}) {
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  async function remove() {
    onActionError("");
    try {
      await deleteEntry.mutateAsync(entry);
    } catch (caught) {
      onActionError(await apiErrorMessage(caught));
    }
  }

  const [form, setForm] = useState<EntryFormValues>(() => ({
    date: dateKey(entry.start),
    title:
      entry.title ||
      (entry.taskId != null ? (taskTitles.get(entry.taskId) ?? "") : ""),
    minutes: String(entryMinutes(entry)),
  }));
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseEntryForm(form);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError("");
    try {
      await updateEntry.mutateAsync({ entry, input: parsed.input });
      close();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <Modal
      kicker="ZMIANA SZCZEGÓŁÓW"
      title="Edytuj wpis"
      titleId="entry-edit-title"
      onClose={close}
      onEdit={isEditing ? undefined : () => setIsEditing(true)}
      size="lg"
    >
      <form onSubmit={submit}>
        <fieldset disabled={!isEditing} className="contents">
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
          <Field label="Zadanie">
            <TaskTitleInput
              suggestions={tasks.map((task) => task.title)}
              value={form.title}
              onChange={(title) =>
                setForm((current) => ({ ...current, title }))
              }
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
        </fieldset>
        {error && <ErrorAlert>{error}</ErrorAlert>}
        {isEditing && (
          <ModalFooter>
            <Button
              variant="ghostDanger"
              className="mr-auto"
              onClick={() => {
                close();
                void remove();
              }}
            >
              Usuń
            </Button>
            <Button variant="secondary" onClick={close}>
              Anuluj
            </Button>
            <Button variant="primary" type="submit">
              Zapisz zmiany
            </Button>
          </ModalFooter>
        )}
      </form>
    </Modal>
  );
}
