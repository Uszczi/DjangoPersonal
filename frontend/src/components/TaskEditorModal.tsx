import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { TaskResponse } from "@/generated/api";
import { useProjectsStore } from "@/stores/projects";
import { useTasksStore, type TaskInput } from "@/stores/tasks";

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
  const projects = useProjectsStore((state) => state.projects);
  const saveTask = useTasksStore((state) => state.saveTask);

  const initialProjectId = task?.projectId ?? projectId ?? 0;

  const [form, setForm] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    project: initialProjectId,
    status: task?.status ?? "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
      className="fixed inset-0 z-5 flex items-start justify-center bg-[rgb(12_29_33/52%)] px-0 py-4 pt-16 md:px-5 md:py-5 md:pt-5 md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              {task ? "ZMIANA SZCZEGÓŁÓW" : "NOWE ZADANIE"}
            </p>
            <h2
              id={titleId}
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              {task ? (
                "Edytuj zadanie"
              ) : (
                <>Dodaj do {targetProject?.name ?? "Inbox"}</>
              )}
            </h2>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] text-[#64797c] transition-all hover:-translate-y-px hover:bg-[#eaf0ed] cursor-pointer"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Tytuł zadania</span>
            <textarea
              ref={titleRef}
              className="w-full resize-none rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              autoFocus
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
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Opis (opcjonalnie)</span>
            <textarea
              ref={descriptionRef}
              className="w-full min-h-[80px] resize-none rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              rows={3}
              value={form.description}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }));
              }}
            />
          </label>
          {task && (
            <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
              <span>Projekt zadania</span>
              <select
                className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          {statuses.length > 0 && (
            <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
              <span>Status</span>
              <select
                className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
              </select>
            </label>
          )}
          {formError && (
            <p
              className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="mt-[26px] flex justify-end gap-[9px] border-t border-[#e1e8e3] pt-[18px]">
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
              type="button"
              onClick={close}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#b94b31] disabled:cursor-wait disabled:opacity-70"
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
