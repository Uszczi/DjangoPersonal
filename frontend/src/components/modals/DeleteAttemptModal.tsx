import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { attemptDates } from "@personal/shared/bibliographyFormat";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { AttemptResponse } from "@personal/shared/generated/api";
import { useDeleteAttempt } from "@personal/shared/queries/bibliographyAttempts";

type DeleteAttemptModalProps = {
  attempt: AttemptResponse;
  onClose: () => void;
};

export function DeleteAttemptModal({
  attempt,
  onClose,
}: DeleteAttemptModalProps) {
  const deleteAttempt = useDeleteAttempt();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const dates = attemptDates(attempt);

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteAttempt.mutateAsync({
        id: attempt.id,
        itemId: attempt.itemId,
      });
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
      title="Usunąć podejście?"
      titleId="attempt-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-ink-soft break-words">
        {dates ? `Podejście (${dates})` : "Podejście"} zostanie trwale usunięte.
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
          {isDeleting ? "Usuwanie…" : "Usuń podejście"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
