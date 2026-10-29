import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { DeleteTaskModal } from "@/components/modals/DeleteTaskModal";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  Select,
  TextArea,
} from "@/design-system";
import { ShowModal } from "@/stores/modal";
import type { TaskResponse } from "@personal/shared/generated/api";
import { useProjects } from "@personal/shared/queries/projects";
import { useSaveTask, type TaskInput } from "@personal/shared/queries/tasks";
import {
  initialNewTaskStatus,
  useNewTaskStatusStore,
} from "@personal/shared/stores/newTaskStatus";

type TaskEditorModalProps = {
  /** Omit (or pass `null`) to create a new TaskResponse; pass a TaskResponse to edit it. */
  task?: TaskResponse | null;
  /** The ProjectResponse a new TaskResponse is created in. Ignored when editing. */
  projectId?: number;
  onClose: () => void;
};

export function TaskEditorModal({
  task = null,
  projectId,
  onClose,
}: TaskEditorModalProps) {
  const { data: projects = [] } = useProjects();
  const saveTask = useSaveTask();
  const lastStatusByProject = useNewTaskStatusStore(
    (state) => state.lastStatusByProject,
  );
  const rememberStatus = useNewTaskStatusStore((state) => state.rememberStatus);

  const initialProjectId = task?.projectId ?? projectId ?? 0;

  const [form, setForm] = useState<TaskInput>(() => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    project: initialProjectId,
    status:
      task?.status ??
      initialNewTaskStatus(
        lastStatusByProject,
        initialProjectId,
        projects.find((item) => item.id === initialProjectId)
          ?.projectStatuses ?? [],
      ),
  }));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(!task);

  const targetProject = projects.find((item) => item.id === form.project);
  const statuses = targetProject?.projectStatuses ?? [];

  const titleId = task ? "task-edit-title" : "task-dialog-title";
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeTextarea(element: HTMLTextAreaElement | null) {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  useEffect(() => {
    resizeTextarea(titleRef.current);
  }, [form.title]);

  useEffect(() => {
    resizeTextarea(descriptionRef.current);
  }, [form.description]);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const status =
      typeof form.status === "string" && statuses.includes(form.status)
        ? form.status
        : statuses[0];
    const input = {
      title: form.title.trim(),
      description: form.description.trim(),
      project: form.project,
      status,
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
      await saveTask.mutateAsync({ input, task });
      if (!task && status) rememberStatus(input.project, status);
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      kicker={task ? "ZMIANA SZCZEGÓŁÓW" : "NOWE ZADANIE"}
      title={
        task ? "Edytuj zadanie" : <>Dodaj do {targetProject?.name ?? "Inbox"}</>
      }
      titleId={titleId}
      onClose={close}
      onEdit={isEditing ? undefined : () => setIsEditing(true)}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <fieldset disabled={!isEditing} className="contents">
          <Field label="Tytuł zadania">
            <TextArea
              ref={titleRef}
              resize="none"
              autoCapitalize="sentences"
              maxLength={200}
              rows={1}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
            />
          </Field>
          <Field label="Opis (opcjonalnie)">
            <TextArea
              ref={descriptionRef}
              resize="none"
              className="min-h-[80px]"
              rows={3}
              value={form.description}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
            />
          </Field>
          {task && (
            <Field label="Projekt zadania">
              <Select
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
              </Select>
            </Field>
          )}
          {statuses.length > 0 && (
            <Field label="Status">
              <Select
                value={form.status || statuses[0]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </fieldset>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        {isEditing && (
          <ModalFooter>
            {task && (
              <Button
                variant="ghostDanger"
                className="mr-auto"
                onClick={() => {
                  onClose();
                  ShowModal(DeleteTaskModal, { task });
                }}
                disabled={isSaving}
              >
                Usuń
              </Button>
            )}
            <Button variant="secondary" onClick={close} disabled={isSaving}>
              Anuluj
            </Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving
                ? "Zapisywanie…"
                : task
                  ? "Zapisz zmiany"
                  : "Utwórz zadanie"}
            </Button>
          </ModalFooter>
        )}
      </form>
    </Modal>
  );
}
