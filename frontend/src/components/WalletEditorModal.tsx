import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { WalletResponse } from "@/generated/api";
import { useWalletsStore, type WalletInput } from "@/stores/wallets";

type WalletEditorModalProps = {
  /** Omit (or pass `null`) to create a new WalletResponse; pass a WalletResponse to edit it. */
  wallet?: WalletResponse | null;
  onClose: () => void;
};

export function WalletEditorModal({
  wallet = null,
  onClose,
}: WalletEditorModalProps) {
  const saveWallet = useWalletsStore((state) => state.saveWallet);

  const [form, setForm] = useState<WalletInput>({
    name: wallet?.name ?? "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name: form.name.trim() };

    if (!input.name) {
      setFormError("Podaj nazwę portfela.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await saveWallet(input, wallet);
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
        aria-labelledby="wallet-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">
              {wallet ? "ZMIANA SZCZEGÓŁÓW" : "NOWE MIEJSCE"}
            </p>
            <h2 id="wallet-dialog-title">
              {wallet ? "Edytuj portfel" : "Nowy portfel"}
            </h2>
          </div>
          <button
            className="icon-button close-button"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Nazwa portfela</span>
            <input
              autoFocus
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
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
              {isSaving
                ? "Zapisywanie…"
                : wallet
                  ? "Zapisz zmiany"
                  : "Utwórz portfel"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
