import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { WalletResponse } from "@/generated/api";
import { useWalletsStore } from "@/stores/wallets";

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
        aria-labelledby="wallet-delete-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
            <h2 id="wallet-delete-title">Usunąć portfel?</h2>
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
          Portfel „{wallet.name}" zostanie trwale usunięty wraz ze wszystkimi
          jego transakcjami.
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
            {isDeleting ? "Usuwanie…" : "Usuń portfel"}
          </button>
        </div>
      </section>
    </div>
  );
}
