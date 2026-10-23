import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@/apiErrorMessage";
import { DeleteProjectModal } from "@/components/modals/DeleteProjectModal";
import { Button, ErrorAlert, Field, Modal, ModalFooter, Select, TextArea, TextInput } from "@/design-system";
import type { ProjectResponse } from "@/generated/api";
import { ShowModal } from "@/stores/modal";
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
    <Modal
      kicker={project ? "ZMIANA SZCZEGÓŁÓW" : "NOWE MIEJSCE"}
      title={project ? "Edytuj projekt" : "Nowy projekt"}
      titleId="dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Field
          label="Nazwa projektu"
          hint={project?.isInbox ? "Nazwa Inbox jest stała." : undefined}
        >
          <TextInput
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
        </Field>
        <Field label="Opis (opcjonalnie)">
          <TextArea
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Statusy (w kolejności wyświetlania)">
          <div className="grid gap-2">
            {form.statuses.map((status, index) => (
              <div className="flex gap-2" key={index}>
                <input
                  className="flex-1 rounded border border-control-border bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-accent focus:ring-[3px] focus:ring-accent/15"
                  value={status}
                  onChange={(event) => updateStatus(index, event.target.value)}
                  aria-label={`Status ${index + 1}`}
                />
                <button
                  type="button"
                  className="inline-flex h-[38px] w-[34px] flex-none items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-icon transition-all hover:-translate-y-px disabled:opacity-40 cursor-pointer"
                  onClick={() => removeStatus(index)}
                  disabled={form.statuses.length <= 1}
                  aria-label={`Usuń status ${index + 1}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={addStatus}
          >
            <span aria-hidden="true">+</span> Dodaj status
          </Button>
        </Field>
        <Field label={'Status końcowy („zrobione")'}>
          <Select
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
          </Select>
        </Field>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          {project && !project.isInbox && (
            <Button
              variant="ghostDanger"
              className="mr-auto"
              onClick={() => {
                onClose();
                ShowModal(DeleteProjectModal, { project });
              }}
              disabled={isSaving}
            >
              Usuń
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={close}
            disabled={isSaving}
          >
            Anuluj
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? "Zapisywanie…"
              : project
                ? "Zapisz zmiany"
                : "Utwórz projekt"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
