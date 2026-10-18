import { useState } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { CategoryResponse } from "@/generated/api";
import { useCategoriesStore } from "@/stores/categories";

type DeleteCategoryModalProps = {
  category: CategoryResponse;
  onClose: () => void;
};

export function DeleteCategoryModal({
  category,
  onClose,
}: DeleteCategoryModalProps) {
  const confirmCategoryDelete = useCategoriesStore(
    (state) => state.confirmCategoryDelete,
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
      await confirmCategoryDelete(category);
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
        aria-labelledby="category-delete-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
            <h2 id="category-delete-title">Usunąć kategorię?</h2>
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
          Kategoria „{category.name}" zostanie trwale usunięta wraz ze wszystkimi
          transakcjami, które do niej należą.
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
            {isDeleting ? "Usuwanie…" : "Usuń kategorię"}
          </button>
        </div>
      </section>
    </div>
  );
}
