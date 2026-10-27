/**
 * A wallet's transactions as server state: a keyset-paged infinite query plus
 * the create/update/delete mutations that keep its cached pages in step.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import {
  parseDate,
  type TransactionPageResponse,
  type TransactionResponse,
} from "../generated/api";
import { compareNewestFirst, withPlaced } from "../transactionList";
import { transactionKeys } from "./keys";
import { refreshWallets } from "./wallets";

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

type Pages = InfiniteData<TransactionPageResponse, string | null>;

function flatten(data: Pages) {
  return data.pages.flatMap((page) => page.items);
}

/**
 * The wallet's transactions, newest first, a page (50 by default) at a time;
 * `null` waits for a wallet.
 */
export function useWalletTransactions(walletId: number | null) {
  return useInfiniteQuery({
    queryKey: transactionKeys.wallet(walletId ?? 0),
    queryFn: ({ pageParam, signal }) =>
      api.transactionsList(
        { wallet: walletId ?? 0, cursor: pageParam ?? undefined },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: walletId !== null,
    select: flatten,
  });
}

function without(data: Pages, id: number): Pages {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== id),
    })),
  };
}

/**
 * Put a transaction where the server would list it, among the pages already
 * loaded. One that sorts after the last loaded row while more pages exist is
 * left out: its page has not been fetched yet, and the keyset cursor (a key,
 * not an offset) brings it in with that page, with no gap or duplicate.
 */
function placed(data: Pages, transaction: TransactionResponse): Pages {
  const pages = without(data, transaction.id).pages;
  let target = pages.findIndex((page) => {
    const last = page.items[page.items.length - 1];
    return last !== undefined && compareNewestFirst(transaction, last) < 0;
  });
  if (target === -1) {
    // Older than every loaded row: it belongs at the very end, if that is loaded.
    const lastPage = pages[pages.length - 1];
    if (!lastPage || lastPage.nextCursor) return { ...data, pages };
    target = pages.length - 1;
  }
  return {
    ...data,
    pages: pages.map((page, n) =>
      n === target
        ? { ...page, items: withPlaced(page.items, transaction, false) }
        : page,
    ),
  };
}

function updateWalletPages(
  queryClient: QueryClient,
  walletId: number,
  update: (data: Pages) => Pages,
) {
  queryClient.setQueryData<Pages>(transactionKeys.wallet(walletId), (data) =>
    data ? update(data) : data,
  );
}

/**
 * Create (no `transaction`) or update a transaction. The server's answer is
 * written straight into the cached pages, so the list changes without a
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
        updateWalletPages(queryClient, transaction.walletId, (data) =>
          without(data, saved.id),
        );
      }
      updateWalletPages(queryClient, saved.walletId, (data) =>
        placed(data, saved),
      );
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
      updateWalletPages(queryClient, transaction.walletId, (data) =>
        without(data, transaction.id),
      );
      void refreshWallets(queryClient, [transaction.walletId]);
    },
  });
}
