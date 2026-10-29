import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { useDeleteBibliographyItem } from "@personal/shared/queries/bibliographyItems";

type DeleteBibliographyItemModalProps = {
  item: BibliographyItemResponse;
  /** Called after the item is gone, e.g. to leave its page. */
  onDeleted?: () => void;
  onClose: () => void;
};

export function DeleteBibliographyItemModal({
  item,
  onDeleted,
  onClose,
}: DeleteBibliographyItemModalProps) {
  const deleteItem = useDeleteBibliographyItem();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteItem.mutateAsync(item.id);
      onClose();
      onDeleted?.();
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      kicker="POTWIERDŹ USUNIĘCIE"
      title="Usunąć pozycję?"
      titleId="bibliography-item-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-ink-soft break-words">
        Pozycja „{item.title}" i wszystkie jej podejścia zostaną trwale
        usunięte.
      </p>
      {deleteError && <ErrorAlert>{deleteError}</ErrorAlert>}
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={isDeleting}>
          Anuluj
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
        >
          {isDeleting ? "Usuwanie…" : "Usuń pozycję"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
