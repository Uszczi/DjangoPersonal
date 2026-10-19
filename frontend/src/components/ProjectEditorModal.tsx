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

  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    statuses: project?.projectStatuses ?? ["Todo", "Zrobione"],
    terminalStatus: project?.terminalStatus ?? "Zrobione",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  function updateStatus(index: number, value: string) {
    setForm((current) => ({
      ...current,
      statuses: current.statuses.map((status, i) =>
        i === index ? value : status,
      ),
    }));
  }

  function addStatus() {
    setForm((current) => ({ ...current, statuses: [...current.statuses, ""] }));
  }

  function removeStatus(index: number) {
    setForm((current) => ({
      ...current,
      statuses: current.statuses.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const statuses = form.statuses.map((status) => status.trim()).filter(Boolean);

    if (!name) {
      setFormError("Podaj nazwę projektu.");
      return;
    }
    if (statuses.length === 0) {
      setFormError("Dodaj przynajmniej jeden status.");
      return;
    }
    if (new Set(statuses).size !== statuses.length) {
      setFormError("Statusy nie mogą się powtarzać.");
      return;
    }
    const terminalStatus = statuses.includes(form.terminalStatus)
      ? form.terminalStatus
      : statuses[statuses.length - 1];

    const input: ProjectInput = {
      name,
      description: form.description.trim(),
      projectStatuses: statuses,
      terminalStatus,
    };

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
          <div className="form-field">
            <span>Statusy (w kolejności wyświetlania)</span>
            <div className="status-list">
              {form.statuses.map((status, index) => (
                <div className="status-row" key={index}>
                  <input
                    value={status}
                    onChange={(event) => updateStatus(index, event.target.value)}
                    aria-label={`Status ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeStatus(index)}
                    disabled={form.statuses.length <= 1}
                    aria-label={`Usuń status ${index + 1}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="quiet-button" onClick={addStatus}>
              <span aria-hidden="true">+</span> Dodaj status
            </button>
          </div>
          <label className="form-field">
            <span>Status końcowy („zrobione")</span>
            <select
              value={form.terminalStatus}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  terminalStatus: event.target.value,
                }))
              }
            >
              {form.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
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
