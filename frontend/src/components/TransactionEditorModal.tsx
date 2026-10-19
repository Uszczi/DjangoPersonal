import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { TransactionResponse } from "@/generated/api";
import { useCategoriesStore } from "@/stores/categories";
import {
  useTransactionsStore,
  type TransactionInput,
} from "@/stores/transactions";
import { useWalletsStore } from "@/stores/wallets";

type TransactionEditorModalProps = {
  /** Omit (or pass `null`) to create a new transaction; pass one to edit it. */
  transaction?: TransactionResponse | null;
  /** The wallet the page is showing; the default choice for a new transaction. */
  walletId: number;
  onClose: () => void;
};

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Local `yyyy-mm-dd` for the (local-midnight) date the client hands us. */
function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function validateAmount(raw: string): string {
  if (!raw) return "Podaj kwotę.";
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0) return "Kwota musi być większa od zera.";
  const fraction = raw.split(".")[1];
  if (fraction && fraction.length > 2)
    return "Kwota może mieć maksymalnie 2 miejsca dziesiętne.";
  return "";
}

export function TransactionEditorModal({
  transaction = null,
  walletId,
  onClose,
}: TransactionEditorModalProps) {
  const saveTransaction = useTransactionsStore(
    (state) => state.saveTransaction,
  );
  const wallets = useWalletsStore((state) => state.wallets);
  const categories = useCategoriesStore((state) => state.categories);

  const [form, setForm] = useState({
    title: transaction?.title ?? "",
    amount: transaction?.amount ?? "",
    date: transaction ? dateKey(transaction.date) : todayKey(),
    description: transaction?.description ?? "",
    category: transaction?.categoryId != null ? String(transaction.categoryId) : "",
    wallet: String(transaction?.walletId ?? walletId),
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: TransactionInput = {
      title: form.title.trim(),
      amount: form.amount.trim(),
      date: form.date,
      description: form.description.trim(),
      category: form.category ? Number(form.category) : null,
      wallet: Number(form.wallet),
    };

    if (!input.title) {
      setFormError("Podaj tytuł.");
      return;
    }
    const amountError = validateAmount(input.amount);
    if (amountError) {
      setFormError(amountError);
      return;
    }
    if (!input.date) {
      setFormError("Podaj datę.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await saveTransaction(input, transaction);
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
        aria-labelledby="transaction-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">
              {transaction ? "ZMIANA SZCZEGÓŁÓW" : "NOWY WYDATEK"}
            </p>
            <h2 id="transaction-dialog-title">
              {transaction ? "Edytuj transakcję" : "Nowa transakcja"}
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

        {/* noValidate: the JS checks below own validation, so the browser never
            blocks submit (e.g. a decimal amount is not a multiple of step). */}
        <form onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Tytuł</span>
            <input
              autoFocus
              maxLength={200}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Kwota</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Data</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Opis</span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className="form-field">
            <span>Kategoria</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            >
              <option value="">Bez kategorii</option>
              {categories
                .filter(
                  (category) =>
                    !category.isSystem ||
                    category.id === transaction?.categoryId,
                )
                .map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="form-field">
            <span>Portfel</span>
            <select
              value={form.wallet}
              onChange={(event) =>
                setForm((current) => ({ ...current, wallet: event.target.value }))
              }
            >
              {wallets.map((wallet) => (
                <option key={wallet.id} value={String(wallet.id)}>
                  {wallet.name}
                </option>
              ))}
            </select>
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
                : transaction
                  ? "Zapisz zmiany"
                  : "Dodaj transakcję"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
