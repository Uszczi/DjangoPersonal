import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { ProjectResponse } from "@/generated/api";
import { useProjectsStore, type ProjectInput } from "@/stores/projects";

type ProjectEditorModalProps = {
  /** Omit (or pass `null`) to create a new ProjectResponse; pass a ProjectResponse to edit it. */
  project?: ProjectResponse | null;
  onClose: () => void;
};

export function ProjectEditorModal({
  project = null,
  onClose,
}: ProjectEditorModalProps) {
  const navigate = useNavigate();
  const saveProject = useProjectsStore((state) => state.saveProject);

  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? "",
    description: project?.description ?? "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      name: form.name.trim(),
      description: form.description.trim(),
    };

    if (!input.name) {
      setFormError("Podaj nazwę projektu.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const savedProject = await saveProject(input, project);
      navigate({ to: "/tasks", search: { project: savedProject.id } });
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
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">
              {project ? "ZMIANA SZCZEGÓŁÓW" : "NOWE MIEJSCE"}
            </p>
            <h2 id="dialog-title">
              {project ? "Edytuj projekt" : "Nowy projekt"}
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
            <span>Nazwa projektu</span>
            <input
              autoFocus
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              readOnly={Boolean(project?.isInbox)}
              required
            />
            {project?.isInbox && <small>Nazwa Inbox jest stała.</small>}
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
                : project
                  ? "Zapisz zmiany"
                  : "Utwórz projekt"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
