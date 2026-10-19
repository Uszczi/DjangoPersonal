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
      className="fixed inset-0 z-5 flex items-start justify-center bg-[rgb(12_29_33/52%)] px-0 py-4 pt-16 md:px-5 md:py-5 md:pt-5 md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              {project ? "ZMIANA SZCZEGÓŁÓW" : "NOWE MIEJSCE"}
            </p>
            <h2
              id="dialog-title"
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              {project ? "Edytuj projekt" : "Nowy projekt"}
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
            <span>Nazwa projektu</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
            {project?.isInbox && (
              <small className="text-[11px] font-normal text-[#718487]">
                Nazwa Inbox jest stała.
              </small>
            )}
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Opis (opcjonalnie)</span>
            <textarea
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          <div className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Statusy (w kolejności wyświetlania)</span>
            <div className="grid gap-2">
              {form.statuses.map((status, index) => (
                <div className="flex gap-2" key={index}>
                  <input
                    className="flex-1"
                    value={status}
                    onChange={(event) => updateStatus(index, event.target.value)}
                    aria-label={`Status ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="inline-flex h-[38px] w-[34px] flex-none items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-[#64797c] transition-all hover:-translate-y-px disabled:opacity-40 cursor-pointer"
                    onClick={() => removeStatus(index)}
                    disabled={form.statuses.length <= 1}
                    aria-label={`Usuń status ${index + 1}`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
              onClick={addStatus}
            >
              <span aria-hidden="true">+</span> Dodaj status
            </button>
          </div>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Status końcowy („zrobione")</span>
            <select
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
