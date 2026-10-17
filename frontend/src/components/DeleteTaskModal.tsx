import { useState } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { TaskResponse } from "@/generated/api";
import { useTasksStore } from "@/stores/tasks";

type DeleteTaskModalProps = {
  task: TaskResponse;
  onClose: () => void;
};

export function DeleteTaskModal({ task, onClose }: DeleteTaskModalProps) {
  const confirmDelete = useTasksStore((state) => state.confirmDelete);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await confirmDelete(task);
      onClose();
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
        aria-labelledby="task-delete-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
            <h2 id="task-delete-title">Usunąć zadanie?</h2>
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
          Zadanie „{task.title}" zostanie trwale usunięte. Tej operacji nie
          można cofnąć.
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
            {isDeleting ? "Usuwanie…" : "Usuń zadanie"}
          </button>
        </div>
      </section>
    </div>
  );
}
