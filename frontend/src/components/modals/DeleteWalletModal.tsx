import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { WalletResponse } from "@personal/shared/generated/api";
import { useWalletsStore } from "@personal/shared/stores/wallets";

type DeleteWalletModalProps = {
  wallet: WalletResponse;
  onClose: () => void;
};

export function DeleteWalletModal({
  wallet,
  onClose,
}: DeleteWalletModalProps) {
  const navigate = useNavigate();
  const confirmWalletDelete = useWalletsStore(
    (state) => state.confirmWalletDelete,
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
      await confirmWalletDelete(wallet);
      onClose();
      // Decision 05: a deleted wallet always returns to the wallet list.
      navigate({ to: "/expenses" });
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      kicker="POTWIERDŹ USUNIĘCIE"
      title="Usunąć portfel?"
      titleId="wallet-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-[#40595c] break-words">
        Portfel „{wallet.name}" zostanie trwale usunięty wraz ze wszystkimi
        jego transakcjami.
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
          {isDeleting ? "Usuwanie…" : "Usuń portfel"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
