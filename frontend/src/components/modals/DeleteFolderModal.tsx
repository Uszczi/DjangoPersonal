import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { FolderResponse } from "@personal/shared/generated/api";
import { useFoldersStore } from "@/stores/folders";
import { useWhiteboardsStore } from "@/stores/whiteboards";

type DeleteFolderModalProps = {
  folder: FolderResponse;
  /** How many Whiteboards and Notatki go with it, its subfolders' included. */
  itemCount: number;
  /** How many Folders below it go with it. */
  subfolderCount?: number;
  onClose: () => void;
};

/** Polish plural for the item count: 1 element, 2 elementy, 5 elementów. */
function itemCountLabel(count: number) {
  if (count === 1) return "1 element";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} elementy`;
  }
  return `${count} elementów`;
}

/**
 * Deleting a Folder destroys what is in it, and there is no undo, so the question
 * says how many items will go.
 */
export function DeleteFolderModal({
  folder,
  itemCount,
  subfolderCount = 0,
  onClose,
}: DeleteFolderModalProps) {
  const deleteFolder = useFoldersStore((state) => state.deleteFolder);
  const dropFolderItems = useWhiteboardsStore((state) => state.dropFolderItems);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const question =
    itemCount === 0
      ? `Usunąć folder „${folder.name}”?`
      : `Usunąć folder „${folder.name}” i ${itemCountLabel(itemCount)} w nim?`;

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      dropFolderItems(await deleteFolder(folder.id));
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
      title={question}
      titleId="folder-delete-title"
      onClose={close}
      size="md"
    >
      {(itemCount > 0 || subfolderCount > 0) && (
        <p className="m-0 mt-5 text-[13px] leading-relaxed text-ink-soft break-words">
          {subfolderCount > 0
            ? `Podfoldery (${subfolderCount}) oraz tablice i notatki w nich zostaną trwale usunięte.`
            : "Tablice i notatki z tego folderu zostaną trwale usunięte."}
        </p>
      )}
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
          {isDeleting ? "Usuwanie…" : "Usuń folder"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
