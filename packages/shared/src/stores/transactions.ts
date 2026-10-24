import { create } from "zustand";

import { api } from "../api";
import { parseDate, type TransactionResponse } from "../generated/api";
import { createLoadGuard } from "./loadGuard";

export type TransactionInput = {
  title: string;
  amount: string;
  date: string;
  description: string;
  category: number | null;
  wallet: number;
};

/** The API contract types `date` as a Date; the form carries the wire string. */
function toRequest(input: TransactionInput) {
  return { ...input, date: parseDate(input.date) };
}

/** Newest first, matching the server's order (date desc, then id desc). */
function newestFirst(transactions: TransactionResponse[]): TransactionResponse[] {
  return [...transactions].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );
}

export type TransactionListState = {
  walletId: number;
  transactions: TransactionResponse[];
} | null;
export type TransactionLoadError = {
  walletId: number;
  message: string;
} | null;

type TransactionsState = {
  transactionList: TransactionListState;
  loadError: TransactionLoadError;
  loadTransactions: (walletId: number) => Promise<void>;
  saveTransaction: (
    input: TransactionInput,
    transaction?: TransactionResponse | null,
  ) => Promise<TransactionResponse>;
  confirmTransactionDelete: (transaction: TransactionResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

export const useTransactionsStore = create<TransactionsState>((set) => ({
  transactionList: null,
  loadError: null,

  loadTransactions: async (walletId) => {
    const requestId = loadGuard.nextRequestId();

    try {
      const loaded = await api.transactionsList({ wallet: walletId });
      if (!loadGuard.isLatest(requestId)) return;
      set({
        transactionList: { walletId, transactions: loaded },
        loadError: null,
      });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          loadError: {
            walletId,
            message: "Nie udało się wczytać transakcji. Spróbuj ponownie.",
          },
        });
      }
    }
  },

  saveTransaction: async (input, transaction) => {
    if (transaction) {
      const updated = await api.transactionsPartialUpdate({
        id: transaction.id,
        patchedTransactionRequest: toRequest(input),
      });
      set((state) => {
        const current = state.transactionList;
        if (!current) return {};
        const wasVisible = current.transactions.some(
          (item) => item.id === transaction.id,
        );
        const belongsInList = updated.walletId === current.walletId;
        if (!wasVisible && !belongsInList) return {};
        const transactions = belongsInList
          ? newestFirst([
              ...current.transactions.filter((item) => item.id !== updated.id),
              updated,
            ])
          : current.transactions.filter((item) => item.id !== updated.id);
        return { transactionList: { walletId: current.walletId, transactions } };
      });
      return updated;
    }

    const created = await api.transactionsCreate({
      transactionRequest: toRequest(input),
    });
    set((state) => {
      const current = state.transactionList;
      if (!current || current.walletId !== input.wallet) return {};
      return {
        transactionList: {
          walletId: current.walletId,
          transactions: newestFirst([...current.transactions, created]),
        },
      };
    });
    return created;
  },

  confirmTransactionDelete: async (transaction) => {
    await api.transactionsDestroy({ id: transaction.id });

    set((state) => {
      const current = state.transactionList;
      if (!current) return {};
      return {
        transactionList: {
          walletId: current.walletId,
          transactions: current.transactions.filter(
            (item) => item.id !== transaction.id,
          ),
        },
      };
    });
  },
}));
