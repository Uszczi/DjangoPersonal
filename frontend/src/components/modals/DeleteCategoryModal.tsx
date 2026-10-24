import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { CategoryResponse } from "@personal/shared/generated/api";
import { useCategoriesStore } from "@personal/shared/stores/categories";

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
    <Modal
      kicker="POTWIERDŹ USUNIĘCIE"
      title="Usunąć kategorię?"
      titleId="category-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-[#40595c] break-words">
        Kategoria „{category.name}" zostanie trwale usunięta wraz ze wszystkimi
        transakcjami, które do niej należą.
      </p>
      {deleteError && <ErrorAlert>{deleteError}</ErrorAlert>}
      <ModalFooter>
        <Button
          variant="secondary"
          onClick={close}
          disabled={isDeleting}
        >
          Anuluj
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
        >
          {isDeleting ? "Usuwanie…" : "Usuń kategorię"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
