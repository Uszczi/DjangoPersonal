import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { CounterResponse } from "@personal/shared/generated/api";
import { useDeleteCounter } from "@personal/shared/queries/counters";

type DeleteCounterModalProps = {
  counter: CounterResponse;
  /** Called after the counter is gone, e.g. to leave its page. */
  onDeleted?: () => void;
  onClose: () => void;
};

export function DeleteCounterModal({
  counter,
  onDeleted,
  onClose,
}: DeleteCounterModalProps) {
  const deleteCounter = useDeleteCounter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteCounter.mutateAsync(counter.id);
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
      title="Usunąć licznik?"
      titleId="counter-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-ink-soft break-words">
        Licznik „{counter.name}" i wszystkie jego wpisy zostaną trwale usunięte.
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
          {isDeleting ? "Usuwanie…" : "Usuń licznik"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
