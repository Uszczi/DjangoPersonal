import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { Task } from "@/generated/api";
import { useProjectsStore } from "@/stores/projects";
import { useTasksStore, type TaskInput } from "@/stores/tasks";

type TaskEditorModalProps = {
  /** Omit (or pass `null`) to create a new Task; pass a Task to edit it. */
  task?: Task | null;
  /** The Project a new Task is created in. Ignored when editing. */
  projectId?: number;
  onClose: () => void;
};

export function TaskEditorModal({
  task = null,
  projectId,
  onClose,
}: TaskEditorModalProps) {
  const projects = useProjectsStore((state) => state.projects);
  const saveTask = useTasksStore((state) => state.saveTask);

  const [form, setForm] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    project: task?.project ?? projectId ?? 0,
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const targetProject = projects.find((item) => item.id === form.project);
  const titleId = task ? "task-edit-title" : "task-dialog-title";

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      title: form.title.trim(),
      description: form.description.trim(),
      project: form.project,
    };

    if (!input.title) {
      setFormError("Podaj tytuł zadania.");
      return;
    }
    if (!Number.isInteger(input.project) || input.project <= 0) {
      setFormError("Wybierz projekt dla zadania.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await saveTask(input, task);
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">
              {task ? "ZMIANA SZCZEGÓŁÓW" : "NOWE ZADANIE"}
            </p>
            <h2 id={titleId}>
              {task ? (
                "Edytuj zadanie"
              ) : (
                <>Dodaj do {targetProject?.name ?? "Inbox"}</>
              )}
            </h2>
          </div>
          <button
            className="icon-button close-button"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Tytuł zadania</span>
            <input
              autoFocus
              maxLength={200}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Opis (opcjonalnie)</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          {task && (
            <label className="form-field">
              <span>Projekt zadania</span>
              <select
                value={form.project}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    project: Number(event.target.value),
                  }))
                }
                required
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="quiet-button"
              type="button"
              onClick={close}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? "Zapisywanie…"
                : task
                  ? "Zapisz zmiany"
                  : "Utwórz zadanie"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
