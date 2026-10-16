import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "../apiErrorMessage";
import type { Project } from "../generated/api";
import { useProjectsStore } from "../stores/projects";

type DeleteProjectModalProps = {
  project: Project;
  onClose: () => void;
};

export function DeleteProjectModal({
  project,
  onClose,
}: DeleteProjectModalProps) {
  const navigate = useNavigate();
  const confirmProjectDelete = useProjectsStore(
    (state) => state.confirmProjectDelete,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const fallbackProject = await confirmProjectDelete(project);
      onClose();
      if (fallbackProject) {
        navigate({ to: "/tasks", search: { project: fallbackProject.id } });
      } else {
        navigate({ to: "/tasks" });
      }
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeleting(false);
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
        className="project-dialog confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-delete-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
            <h2 id="project-delete-title">Usunąć projekt?</h2>
          </div>
          <button
            className="icon-button close-button"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="confirm-message">
          Projekt „{project.name}" zostanie trwale usunięty, a jego zadania
          trafią do Inbox.
        </p>
        {deleteError && (
          <p className="form-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="quiet-button"
            type="button"
            onClick={close}
            disabled={isDeleting}
          >
            Anuluj
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "Usuwanie…" : "Usuń projekt"}
          </button>
        </div>
      </section>
    </div>
  );
}
