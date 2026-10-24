import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { DeleteProjectModal } from "@/components/modals/DeleteProjectModal";
import { Button, DragHandle, ErrorAlert, Field, Modal, ModalFooter, Select, TextArea, TextInput } from "@/design-system";
import type { ProjectResponse } from "@personal/shared/generated/api";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore, type ProjectInput } from "@personal/shared/stores/projects";
import { useSortSensors } from "@/useSortSensors";

type ProjectEditorModalProps = {
  /** Omit (or pass `null`) to create a new ProjectResponse; pass a ProjectResponse to edit it. */
  project?: ProjectResponse | null;
  onClose: () => void;
};

/** A status being edited; `id` is stable across edits and reordering, so it keys the sortable row. */
type StatusDraft = { id: number; name: string };

let nextStatusId = 1;
function newStatus(name: string): StatusDraft {
  return { id: nextStatusId++, name };
}

function StatusRow({
  status,
  index,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: {
  status: StatusDraft;
  index: number;
  canRemove: boolean;
  /** Read-only: the row cannot be dragged (the surrounding fieldset disables the inputs). */
  disabled: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: status.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className="flex items-center gap-2"
    >
      <DragHandle
        aria-label={`Przeciągnij status ${index + 1}`}
        {...attributes}
        {...listeners}
      />
      <input
        className="min-w-0 flex-1 rounded border border-control-border bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-accent focus:ring-[3px] focus:ring-accent/15"
        value={status.name}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Status ${index + 1}`}
      />
      <button
        type="button"
        className="inline-flex h-[38px] w-[34px] flex-none items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-icon transition-all hover:-translate-y-px disabled:opacity-40 cursor-pointer"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Usuń status ${index + 1}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function ProjectEditorModal({
  project = null,
  onClose,
}: ProjectEditorModalProps) {
  const navigate = useNavigate();
  const saveProject = useProjectsStore((state) => state.saveProject);
  const sensors = useSortSensors();

  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    statuses: (project?.projectStatuses ?? ["Todo", "Zrobione"]).map(newStatus),
    terminalStatus: project?.terminalStatus ?? "Zrobione",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!project);

  function close() {
    if (!isSaving) onClose();
  }

  function updateStatus(id: number, name: string) {
    setForm((current) => ({
      ...current,
      statuses: current.statuses.map((status) =>
        status.id === id ? { ...status, name } : status,
      ),
    }));
  }

  function addStatus() {
    setForm((current) => ({ ...current, statuses: [...current.statuses, newStatus("")] }));
  }

  function removeStatus(id: number) {
    setForm((current) => ({
      ...current,
      statuses: current.statuses.filter((status) => status.id !== id),
    }));
  }

  function handleStatusDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setForm((current) => {
      const from = current.statuses.findIndex((status) => status.id === active.id);
      const to = current.statuses.findIndex((status) => status.id === over.id);
      return { ...current, statuses: arrayMove(current.statuses, from, to) };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const statuses = form.statuses.map((status) => status.name.trim()).filter(Boolean);

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
      onEdit={isEditing ? undefined : () => setIsEditing(true)}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <fieldset disabled={!isEditing} className="contents">
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStatusDragEnd}
            >
              <SortableContext
                items={form.statuses.map((status) => status.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-2">
                  {form.statuses.map((status, index) => (
                    <StatusRow
                      key={status.id}
                      status={status}
                      index={index}
                      canRemove={form.statuses.length > 1}
                      disabled={!isEditing}
                      onChange={(name) => updateStatus(status.id, name)}
                      onRemove={() => removeStatus(status.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                <option key={status.id} value={status.name}>
                  {status.name}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        {isEditing && (
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
        )}
      </form>
    </Modal>
  );
}
