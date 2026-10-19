import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useEffect } from "react";

import { TransactionEditorModal } from "@/components/TransactionEditorModal";
import { DeleteTransactionModal } from "@/components/DeleteTransactionModal";
import { WalletSelect } from "@/components/WalletSelect";
import { type TransactionResponse } from "@/generated/api";
import { ShowModal } from "@/stores/modal";
import { useCategoriesStore } from "@/stores/categories";
import { useTransactionsStore } from "@/stores/transactions";
import { useWalletsStore } from "@/stores/wallets";

export const Route = createFileRoute("/expenses/$walletId")({
  component: WalletDetailPage,
});

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The calendar day a (local-midnight) wire date stands for, as `yyyy-mm-dd`. */
function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Group consecutive transactions by their calendar day, preserving order. */
function groupByDay(
  transactions: TransactionResponse[],
): [string, TransactionResponse[]][] {
  const groups = new Map<string, TransactionResponse[]>();
  for (const transaction of transactions) {
    const key = dayKey(transaction.date);
    const day = groups.get(key) ?? [];
    day.push(transaction);
    groups.set(key, day);
  }
  return [...groups.entries()];
}

export function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const navigate = useNavigate();
  const wallets = useWalletsStore((state) => state.wallets);
  const isLoading = useWalletsStore((state) => state.isLoading);
  const pageError = useWalletsStore((state) => state.pageError);
  const loadWallets = useWalletsStore((state) => state.loadWallets);
  const categories = useCategoriesStore((state) => state.categories);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const transactionList = useTransactionsStore((state) => state.transactionList);
  const transactionLoadError = useTransactionsStore((state) => state.loadError);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => {
    if (wallets.length === 0) {
      void loadWallets();
    }
  }, [wallets.length, loadWallets]);

  const wallet = wallets.find(
    (item) => item.id === Number(walletId),
  );
  const activeWalletId = wallet?.id;

  useEffect(() => {
    if (!isLoading && !pageError && !wallet) {
      navigate({ to: "/expenses" });
    }
  }, [isLoading, pageError, wallet, navigate]);

  useEffect(() => {
    if (activeWalletId != null) {
      void loadTransactions(activeWalletId);
      void loadCategories();
    }
  }, [activeWalletId, loadTransactions, loadCategories]);

  if (isLoading) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie portfela…
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="pt-[40px] text-muted" role="alert">
        {pageError}
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Przekierowywanie…
      </div>
    );
  }

  const visible =
    transactionList?.walletId === wallet.id ? transactionList.transactions : [];
  const groups = groupByDay(visible);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">{wallet.name}</h1>
        </div>
        <WalletSelect activeWalletId={wallet.id} />
        <button
          className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
          onClick={() =>
            ShowModal(TransactionEditorModal, { walletId: wallet.id })
          }
        >
          <span aria-hidden="true">+</span>
          Nowa transakcja
        </button>
      </div>

      {transactionLoadError?.walletId === wallet.id && (
        <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
          {transactionLoadError.message}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak transakcji. Dodaj pierwszą transakcję.</p>
      ) : (
        groups.map(([day, dayTransactions]) => (
          <section className="mb-6" key={day}>
            <h2 className="mb-2 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
              {dayFormatter.format(dayTransactions[0].date)}
            </h2>
            <ul
              className="flex flex-col"
              aria-label={`Transakcje z dnia ${dayFormatter.format(dayTransactions[0].date)}`}
            >
              {dayTransactions.map((transaction) => {
                const category = transaction.categoryId
                  ? categories.find((item) => item.id === transaction.categoryId)
                  : undefined;
                return (
                  <li className="flex min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]" key={transaction.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium leading-snug text-ink">{transaction.title}</p>
                      {transaction.description && (
                        <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">{transaction.description}</small>
                      )}
                      {category && (
                        <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">{category.name}</small>
                      )}
                    </div>
                    <span className="font-utility text-[13px] font-semibold text-ink">{transaction.amount}</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
                        type="button"
                        aria-label={`Edytuj transakcję: ${transaction.title}`}
                        onClick={() =>
                          ShowModal(TransactionEditorModal, {
                            walletId: wallet.id,
                            transaction,
                          })
                        }
                      >
                        Edytuj
                      </button>
                      <button
                        className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#a23a28] transition-all hover:bg-[#f5e3dc] hover:text-[#872d1e]"
                        type="button"
                        aria-label={`Usuń transakcję: ${transaction.title}`}
                        onClick={() =>
                          ShowModal(DeleteTransactionModal, { transaction })
                        }
                      >
                        Usuń
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}