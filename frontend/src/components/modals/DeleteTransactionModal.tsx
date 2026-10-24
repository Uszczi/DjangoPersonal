import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { TransactionResponse } from "@personal/shared/generated/api";
import { useTransactionsStore } from "@personal/shared/stores/transactions";
import { useWalletsStore } from "@personal/shared/stores/wallets";

type DeleteTransactionModalProps = {
  transaction: TransactionResponse;
  onClose: () => void;
};

export function DeleteTransactionModal({
  transaction,
  onClose,
}: DeleteTransactionModalProps) {
  const confirmTransactionDelete = useTransactionsStore(
    (state) => state.confirmTransactionDelete,
  );
  const refreshWallets = useWalletsStore((state) => state.refreshWallets);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await confirmTransactionDelete(transaction);
      // The wallet's balance and count are computed from the ledger.
      void refreshWallets([transaction.walletId]);
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
      title="Usunąć transakcję?"
      titleId="transaction-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-[#40595c] break-words">
        Transakcja „{transaction.title}" zostanie trwale usunięta.
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
          {isDeleting ? "Usuwanie…" : "Usuń transakcję"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
