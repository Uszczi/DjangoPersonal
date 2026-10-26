import { create } from "zustand";

import { api } from "../api";
import { parseDate, type TransactionResponse } from "../generated/api";
import { TRANSACTIONS_LOAD_ERROR, withPlaced } from "../transactionList";
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
export function toTransactionRequest(input: TransactionInput) {
  return { ...input, date: parseDate(input.date) };
}

/** The loaded pages of one wallet's transactions; `nextCursor` is null after the last. */
export type TransactionListState = {
  walletId: number;
  transactions: TransactionResponse[];
  nextCursor: string | null;
} | null;
export type TransactionLoadError = {
  walletId: number;
  message: string;
} | null;

type TransactionsState = {
  transactionList: TransactionListState;
  loadError: TransactionLoadError;
  /** Load the first page of the wallet's transactions. */
  loadTransactions: (walletId: number) => Promise<void>;
  /** Append the next page of the shown wallet, if there is one. */
  loadMoreTransactions: () => Promise<void>;
  saveTransaction: (
    input: TransactionInput,
    transaction?: TransactionResponse | null,
  ) => Promise<TransactionResponse>;
  confirmTransactionDelete: (transaction: TransactionResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactionList: null,
  loadError: null,

  loadTransactions: async (walletId) => {
    const requestId = loadGuard.nextRequestId();

    try {
      const page = await api.transactionsList({ wallet: walletId });
      if (!loadGuard.isLatest(requestId)) return;
      set({
        transactionList: { walletId, transactions: page.items, nextCursor: page.nextCursor },
        loadError: null,
      });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          loadError: {
            walletId,
            message: TRANSACTIONS_LOAD_ERROR,
          },
        });
      }
    }
  },

  loadMoreTransactions: async () => {
    const current = get().transactionList;
    if (!current?.nextCursor) return;
    const requestId = loadGuard.nextRequestId();
    const { walletId } = current;

    try {
      const page = await api.transactionsList({ wallet: walletId, cursor: current.nextCursor });
      if (!loadGuard.isLatest(requestId)) return;
      set((state) => {
        const shown = state.transactionList;
        if (shown?.walletId !== walletId) return {};
        const known = new Set(shown.transactions.map((item) => item.id));
        return {
          transactionList: {
            walletId,
            transactions: [...shown.transactions, ...page.items.filter((item) => !known.has(item.id))],
            nextCursor: page.nextCursor,
          },
          loadError: null,
        };
      });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          loadError: {
            walletId,
            message: TRANSACTIONS_LOAD_ERROR,
          },
        });
      }
    }
  },

  saveTransaction: async (input, transaction) => {
    if (transaction) {
      const updated = await api.transactionsPartialUpdate({
        id: transaction.id,
        patchedTransactionRequest: toTransactionRequest(input),
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
          ? withPlaced(current.transactions, updated, current.nextCursor !== null)
          : current.transactions.filter((item) => item.id !== updated.id);
        return { transactionList: { ...current, transactions } };
      });
      return updated;
    }

    const created = await api.transactionsCreate({
      transactionRequest: toTransactionRequest(input),
    });
    set((state) => {
      const current = state.transactionList;
      if (!current || current.walletId !== input.wallet) return {};
      return {
        transactionList: {
          ...current,
          transactions: withPlaced(current.transactions, created, current.nextCursor !== null),
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
          ...current,
          transactions: current.transactions.filter(
            (item) => item.id !== transaction.id,
          ),
        },
      };
    });
  },
}));
