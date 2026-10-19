import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { WalletResponse } from "@/generated/api";
import { balanceError } from "@/money";
import { useWalletsStore } from "@/stores/wallets";

type WalletEditModalProps = {
  wallet: WalletResponse;
  onClose: () => void;
};

/**
 * The edit modal: rename the wallet and/or state the balance it now holds.
 * Changing the balance writes a System correction, so the ledger keeps
 * summing to what the user says they have.
 */
export function WalletEditModal({ wallet, onClose }: WalletEditModalProps) {
  const updateWallet = useWalletsStore((state) => state.updateWallet);

  const [name, setName] = useState(wallet.name);
  const [currentBalance, setCurrentBalance] = useState(wallet.balance ?? "0.00");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Podaj nazwę portfela.");
      return;
    }
    const balanceProblem = balanceError(currentBalance);
    if (balanceProblem) {
      setFormError(balanceProblem);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await updateWallet(wallet, {
        name: trimmedName,
        currentBalance: currentBalance.trim(),
      });
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
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
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-edit-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">ZMIANA SZCZEGÓŁÓW</p>
            <h2 id="wallet-edit-title">Edytuj portfel</h2>
          </div>
          <button
            className="icon-button close-button"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Nazwa portfela</span>
            <input
              autoFocus
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Stan aktualny</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={currentBalance}
              onChange={(event) => setCurrentBalance(event.target.value)}
            />
          </label>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="quiet-button"
              type="button"
              onClick={close}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Zapisywanie…" : "Zapisz zmiany"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
