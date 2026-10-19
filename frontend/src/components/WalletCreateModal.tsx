import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { balanceError } from "@/money";
import { useWalletsStore } from "@/stores/wallets";

type WalletCreateModalProps = {
  onClose: () => void;
};

/** The create modal: a name and the balance the wallet opens with. */
export function WalletCreateModal({ onClose }: WalletCreateModalProps) {
  const createWallet = useWalletsStore((state) => state.createWallet);

  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
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
    const balanceProblem = balanceError(initialBalance);
    if (balanceProblem) {
      setFormError(balanceProblem);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await createWallet({ name: trimmedName, initialBalance });
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
        aria-labelledby="wallet-create-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">NOWE MIEJSCE</p>
            <h2 id="wallet-create-title">Nowy portfel</h2>
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
            <span>Stan początkowy</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
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
              {isSaving ? "Zapisywanie…" : "Utwórz portfel"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
