import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { formatEntryTime, signedValue } from "@personal/shared/counterFormat";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { CounterEntryResponse } from "@personal/shared/generated/api";
import { useCountersStore } from "@personal/shared/stores/counters";

type DeleteCounterEntryModalProps = {
  entry: CounterEntryResponse;
  onClose: () => void;
};

export function DeleteCounterEntryModal({ entry, onClose }: DeleteCounterEntryModalProps) {
  const deleteEntry = useCountersStore((state) => state.deleteEntry);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteEntry(entry);
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
      title="Usunąć wpis?"
      titleId="counter-entry-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-ink-soft break-words">
        Wpis {signedValue(entry.value)} z {formatEntryTime(entry.occurredAt)} zostanie
        trwale usunięty.
      </p>
      {deleteError && <ErrorAlert>{deleteError}</ErrorAlert>}
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={isDeleting}>
          Anuluj
        </Button>
        <Button variant="danger" onClick={() => void handleDelete()} disabled={isDeleting}>
          {isDeleting ? "Usuwanie…" : "Usuń wpis"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
