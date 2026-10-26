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
export function toTransactionRequest(input: TransactionInput) {
  return { ...input, date: parseDate(input.date) };
}

/** Newest first, matching the server's order (date desc, then id desc). */
function compareNewestFirst(a: TransactionResponse, b: TransactionResponse) {
  return b.date.getTime() - a.date.getTime() || b.id - a.id;
}

/**
 * The loaded pages, flattened, with `transaction` placed where the server
 * would list it. One older than every loaded row while more pages exist is
 * left for its own page, which the keyset cursor still brings in.
 */
function withPlaced(
  list: NonNullable<TransactionListState>,
  transaction: TransactionResponse,
): TransactionResponse[] {
  const rest = list.transactions.filter((item) => item.id !== transaction.id);
  const last = rest[rest.length - 1];
  if (list.nextCursor && last && compareNewestFirst(transaction, last) > 0) return rest;
  return [...rest, transaction].sort(compareNewestFirst);
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
            message: "Nie udało się wczytać transakcji. Spróbuj ponownie.",
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
          ? withPlaced(current, updated)
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
        transactionList: { ...current, transactions: withPlaced(current, created) },
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
