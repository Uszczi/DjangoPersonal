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
      className="fixed inset-0 z-5 flex items-center justify-center bg-[rgb(12_29_33/52%)] p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dialog-title"
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              {transaction ? "ZMIANA SZCZEGÓŁÓW" : "NOWY WYDATEK"}
            </p>
            <h2
              id="transaction-dialog-title"
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              {transaction ? "Edytuj transakcję" : "Nowa transakcja"}
            </h2>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] text-[#64797c] transition-all hover:-translate-y-px hover:bg-[#eaf0ed] cursor-pointer"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* noValidate: the JS checks below own validation, so the browser never
            blocks submit (e.g. a decimal amount is not a multiple of step). */}
        <form onSubmit={handleSubmit} noValidate>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Tytuł</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              autoFocus
              maxLength={200}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Kwota</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              inputMode="decimal"
              autoComplete="off"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              required
            />
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Data</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Opis</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Kategoria</span>
            <select
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Portfel</span>
            <select
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
            <p
              className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="mt-[26px] flex justify-end gap-[9px] border-t border-[#e1e8e3] pt-[18px]">
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
              type="button"
              onClick={close}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#b94b31] disabled:cursor-wait disabled:opacity-70"
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
