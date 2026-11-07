/**
 * A wallet's transactions as server state, a month at a time (the Wydatki
 * dashboard), plus the create/update/delete mutations that keep the cached
 * months in step.
 */
import {
  useMutation,
  useQueries,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import {
  monthBounds,
  monthKeyOf,
  type MonthKey,
} from "../expenseMonth";
import { parseDate, type TransactionResponse } from "../generated/api";
import { compareNewestFirst } from "../transactionList";
import { transactionKeys } from "./keys";
import { refreshWallets } from "./wallets";

export type TransactionInput = {
  title: string;
  amount: string;
  date: string;
  description: string;
  category: string | null;
  wallet: string;
};

/** The API contract types `date` as a Date; the form carries the wire string. */
export function toTransactionRequest(input: TransactionInput) {
  return { ...input, date: parseDate(input.date) };
}

/** The server's largest page: a month almost always fits in one. */
const MONTH_PAGE_SIZE = 200;

async function fetchMonth(
  walletId: string,
  month: MonthKey,
  signal: AbortSignal,
): Promise<TransactionResponse[]> {
  const { first, last } = monthBounds(month);
  const items: TransactionResponse[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.transactionsList(
      {
        wallet: walletId,
        dateFrom: first,
        dateTo: last,
        limit: MONTH_PAGE_SIZE,
        cursor,
      },
      { signal },
    );
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

function monthQuery(walletId: string, month: MonthKey) {
  return {
    queryKey: transactionKeys.month(walletId, month),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchMonth(walletId, month, signal),
  };
}

/**
 * One month (`yyyy-mm`) of the given wallets' transactions together, newest
 * first: one wallet's, or every wallet's for the "Wszystkie" view. Each wallet
 * keeps its own cached month, so the writes below update this view too.
 * `data` waits for every wallet; with no wallets it is empty.
 */
export function useWalletsMonth(walletIds: string[], month: MonthKey) {
  return useQueries({
    queries: walletIds.map((walletId) => monthQuery(walletId, month)),
    combine: (results) => ({
      data: results.every((result) => result.data !== undefined)
        ? results
            .flatMap((result) => result.data ?? [])
            .sort(compareNewestFirst)
        : undefined,
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      refetch: () => Promise.all(results.map((result) => result.refetch())),
    }),
  });
}

/**
 * A transaction of the wallet from its cached months, for an editor opened
 * from the list (the row was on screen, so its month is cached).
 */
export function findCachedTransaction(
  queryClient: QueryClient,
  walletId: string,
  transactionId: string,
): TransactionResponse | undefined {
  for (const [, items] of queryClient.getQueriesData<TransactionResponse[]>({
    queryKey: transactionKeys.months(walletId),
  })) {
    const found = items?.find((item) => item.id === transactionId);
    if (found) return found;
  }
  return undefined;
}

/** Rewrite every cached month of a wallet; `update` gets the month's key too. */
function updateMonths(
  queryClient: QueryClient,
  walletId: string,
  update: (
    items: TransactionResponse[],
    month: MonthKey,
  ) => TransactionResponse[],
) {
  for (const [key, items] of queryClient.getQueriesData<TransactionResponse[]>({
    queryKey: transactionKeys.months(walletId),
  })) {
    if (!items) continue;
    queryClient.setQueryData(key, update(items, key[4] as MonthKey));
  }
}

function without(items: TransactionResponse[], id: string) {
  return items.filter((item) => item.id !== id);
}

/**
 * Create (no `transaction`) or update a transaction. The server's answer is
 * written straight into the cached months (taken out of the month it left,
 * put into the month it is dated in), so the dashboard changes without a
 * refetch; the wallets it touches are refreshed for their balance and count.
 */
export function useSaveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      transaction,
    }: {
      input: TransactionInput;
      transaction?: TransactionResponse | null;
    }) =>
      transaction
        ? api.transactionsPartialUpdate({
            id: transaction.id,
            patchedTransactionRequest: toTransactionRequest(input),
          })
        : api.transactionsCreate({
            transactionRequest: toTransactionRequest(input),
          }),
    onSuccess: (saved, { transaction }) => {
      if (transaction && transaction.walletId !== saved.walletId) {
        updateMonths(queryClient, transaction.walletId, (items) =>
          without(items, saved.id),
        );
      }
      updateMonths(queryClient, saved.walletId, (items, month) => {
        const rest = without(items, saved.id);
        if (monthKeyOf(saved.date) !== month) return rest;
        return [...rest, saved].sort(compareNewestFirst);
      });
      void refreshWallets(
        queryClient,
        transaction ? [transaction.walletId, saved.walletId] : [saved.walletId],
      );
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transaction: TransactionResponse) =>
      api.transactionsDestroy({ id: transaction.id }),
    onSuccess: (_, transaction) => {
      updateMonths(queryClient, transaction.walletId, (items) =>
        without(items, transaction.id),
      );
      void refreshWallets(queryClient, [transaction.walletId]);
    },
  });
}
