import { useState } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/api";
import { useNavigate } from "@tanstack/react-router";

type DeleteAccountModalProps = {
  onClose: () => void;
};

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await api.authDestroy();
      onClose();
      logout();
      navigate({ to: "/login" });
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
        aria-labelledby="account-delete-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
            <h2 id="account-delete-title">Usunąć konto?</h2>
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
          Konto „{user?.username}" wraz z wszystkimi danymi zostanie trwale
          usunięte. Tej operacji nie można cofnąć.
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
            {isDeleting ? "Usuwanie…" : "Usuń konto"}
          </button>
        </div>
      </section>
    </div>
  );
}
