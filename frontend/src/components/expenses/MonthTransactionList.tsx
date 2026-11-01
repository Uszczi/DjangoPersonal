import { X } from "lucide-react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { TransactionEditorModal } from "@/components/modals/TransactionEditorModal";
import { ErrorMessage } from "@/design-system";
import { formatCents, signedCents } from "@personal/shared/expenseMonth";
import type {
  CategoryResponse,
  TransactionResponse,
} from "@personal/shared/generated/api";
import { ShowModal } from "@/stores/modal";
import { TRANSACTIONS_LOAD_ERROR } from "@personal/shared/transactionList";

type Filter = { label: string; onClear: () => void };

type MonthTransactionListProps = {
  walletId: number;
  transactions: TransactionResponse[];
  categories: CategoryResponse[];
  /** The active narrowings (a day, a Category), each removable. */
  filters: Filter[];
  isPending: boolean;
  isError: boolean;
};

const shortDay = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

function amountTone(transaction: TransactionResponse) {
  if (transaction.kind === "income") return "text-income";
  if (transaction.kind === "expense") return "text-expense";
  return "text-muted";
}

/** The month's transactions, one compact row each; a row opens its editor. */
export function MonthTransactionList({
  walletId,
  transactions,
  categories,
  filters,
  isPending,
  isError,
}: MonthTransactionListProps) {
  return (
    <section
      aria-labelledby="month-transactions-title"
      className="order-2 min-w-0 self-start rounded-xl border border-card-line bg-paper lg:order-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3 lg:px-5">
        <h2
          id="month-transactions-title"
          className="font-display text-[17px] font-bold text-ink"
        >
          Transakcje
        </h2>
        <div className="flex flex-wrap justify-end gap-2">
          {filters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-label={`Usuń filtr: ${filter.label}`}
              onClick={filter.onClear}
              className="flex items-center gap-1 rounded-full bg-wash px-3 py-1 text-[12px] text-ink-soft hover:text-ink"
            >
              {filter.label}
              <X aria-hidden="true" className="size-3" />
            </button>
          ))}
        </div>
      </div>
      {isError && <ErrorMessage>{TRANSACTIONS_LOAD_ERROR}</ErrorMessage>}
      <ul aria-label="Transakcje miesiąca">
        {transactions.map((transaction) => {
          const category = categories.find(
            (item) => item.id === transaction.categoryId,
          );
          return (
            <li key={transaction.id}>
              <button
                type="button"
                aria-label={`Edytuj transakcję: ${transaction.title}`}
                onClick={() =>
                  ShowModal(TransactionEditorModal, { walletId, transaction })
                }
                className="grid w-full grid-cols-[48px_28px_1fr_auto] items-center gap-2 border-b border-line-soft px-4 py-2.5 text-left last:border-0 hover:bg-wash lg:grid-cols-[56px_28px_1fr_auto] lg:gap-3 lg:px-5"
              >
                <span className="font-utility text-[12px] text-muted">
                  {shortDay.format(transaction.date)}
                </span>
                <span className="grid size-7 place-items-center rounded-full bg-icon-wash text-icon">
                  {category && (
                    <CategoryIcon icon={category.icon} className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {transaction.title}
                  </span>
                  {transaction.kind === null ? (
                    <span className="block text-[11px] text-muted">
                      Wpis systemowy
                    </span>
                  ) : (
                    transaction.description && (
                      <span className="block truncate text-[11px] text-muted">
                        {transaction.description}
                      </span>
                    )
                  )}
                </span>
                <span
                  className={`font-utility text-[13px] font-semibold ${amountTone(transaction)}`}
                >
                  {formatCents(signedCents(transaction), { sign: true })}
                </span>
              </button>
            </li>
          );
        })}
        {!isPending && !isError && transactions.length === 0 && (
          <li className="px-5 py-6 text-[13px] text-muted">
            {filters.length > 0
              ? "Nic nie pasuje do filtrów."
              : "Brak transakcji w tym miesiącu."}
          </li>
        )}
      </ul>
    </section>
  );
}
