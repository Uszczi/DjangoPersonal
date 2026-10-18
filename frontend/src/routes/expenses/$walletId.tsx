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
      <div className="loading-state" role="status">
        Wczytywanie portfela…
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="loading-state" role="alert">
        {pageError}
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="loading-state" role="status">
        Przekierowywanie…
      </div>
    );
  }

  const visible =
    transactionList?.walletId === wallet.id ? transactionList.transactions : [];
  const groups = groupByDay(visible);

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>{wallet.name}</h1>
        </div>
        <WalletSelect activeWalletId={wallet.id} />
        <button
          className="primary-button"
          onClick={() =>
            ShowModal(TransactionEditorModal, { walletId: wallet.id })
          }
        >
          <span aria-hidden="true">+</span>
          Nowa transakcja
        </button>
      </div>

      {transactionLoadError?.walletId === wallet.id && (
        <p className="task-error" role="alert">
          {transactionLoadError.message}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="task-empty-state">Brak transakcji. Dodaj pierwszą transakcję.</p>
      ) : (
        groups.map(([day, dayTransactions]) => (
          <section className="transaction-day" key={day}>
            <h2 className="transaction-day-heading">
              {dayFormatter.format(dayTransactions[0].date)}
            </h2>
            <ul
              className="transaction-list"
              aria-label={`Transakcje z dnia ${dayFormatter.format(dayTransactions[0].date)}`}
            >
              {dayTransactions.map((transaction) => {
                const category = transaction.categoryId
                  ? categories.find((item) => item.id === transaction.categoryId)
                  : undefined;
                return (
                  <li className="transaction-row" key={transaction.id}>
                    <div className="transaction-row-copy">
                      <p>{transaction.title}</p>
                      {transaction.description && (
                        <small>{transaction.description}</small>
                      )}
                      {category && <small>{category.name}</small>}
                    </div>
                    <span className="transaction-amount">{transaction.amount}</span>
                    <div className="project-row-actions">
                      <button
                        className="task-edit-button"
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
                        className="task-delete-button"
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
