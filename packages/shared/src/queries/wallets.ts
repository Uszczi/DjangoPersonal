/**
 * Wallets as server state: the list query and the writes that keep the cached
 * list in step. Which Wallet `/expenses` shows is client state, in
 * `stores/walletSelection`.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { WalletResponse } from "../generated/api";
import { useWalletSelectionStore } from "../stores/walletSelection";
import { transactionKeys, walletKeys } from "./keys";

/** What the create modal collects: a name, a colour and, optionally, an icon and an opening balance. */
export type WalletCreateInput = {
  name: string;
  color: string;
  icon: string | null;
  initialBalance: string;
};

/** What the edit modal collects: a name, a colour, an icon (`null` for none) and the balance the wallet now holds. */
export type WalletUpdateInput = {
  name: string;
  color: string;
  icon: string | null;
  currentBalance: string;
};

/**
 * The balance to send when editing a wallet, or undefined when it is unchanged.
 * Only a changed balance is sent, so a plain rename never writes a System
 * correction.
 */
export function balanceChange(
  wallet: WalletResponse,
  currentBalance: string,
): string | undefined {
  return currentBalance === (wallet.balance ?? "")
    ? undefined
    : currentBalance.trim() || undefined;
}

/** The selected Wallet if it still exists, else the first one. */
export function validSelection(
  wallets: WalletResponse[],
  selectedWalletId: number | null,
) {
  if (wallets.some((wallet) => wallet.id === selectedWalletId))
    return selectedWalletId;
  return wallets[0]?.id ?? null;
}

/** Mirror the server's `ordering = ['normalized_name']` for inserts. */
function sortKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

export const walletsQuery = queryOptions({
  queryKey: walletKeys.all,
  queryFn: ({ signal }) => api.walletsList({ signal }),
});

export function useWallets() {
  return useQuery(walletsQuery);
}

function replaceWallets(queryClient: QueryClient, fresh: WalletResponse[]) {
  const byId = new Map(fresh.map((wallet) => [wallet.id, wallet]));
  queryClient.setQueryData(walletsQuery.queryKey, (list) =>
    list?.map((item) => byId.get(item.id) ?? item),
  );
}

/**
 * Re-read these Wallets, so balances and counts follow a transaction write.
 * A failed refresh only leaves a stale balance; the write itself succeeded.
 */
export async function refreshWallets(
  queryClient: QueryClient,
  walletIds: number[],
) {
  const results = await Promise.allSettled(
    [...new Set(walletIds)].map((id) => api.walletsRetrieve({ id })),
  );
  replaceWallets(
    queryClient,
    results
      .filter((result) => result.status === "fulfilled")
      .map(({ value }) => value),
  );
}

/** Create a Wallet and select it. */
export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color, icon, initialBalance }: WalletCreateInput) =>
      api.walletsCreate({
        walletCreateRequest: {
          name,
          color,
          icon: icon ?? undefined,
          // Omitted when blank, so a wallet without an opening balance sends
          // exactly the name it always did.
          initialBalance: initialBalance.trim() || undefined,
        },
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(walletsQuery.queryKey, (list) => {
        if (!list) return list;
        const insertAt = list.findIndex(
          (item) => sortKey(item.name) > sortKey(created.name),
        );
        const wallets = [...list];
        wallets.splice(insertAt === -1 ? wallets.length : insertAt, 0, created);
        return wallets;
      });
      useWalletSelectionStore.getState().selectWallet(created.id);
    },
  });
}

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      wallet,
      input,
    }: {
      wallet: WalletResponse;
      input: WalletUpdateInput;
    }) =>
      api.walletsPartialUpdate({
        id: wallet.id,
        patchedWalletRequest: {
          name: input.name,
          color: input.color === wallet.color ? undefined : input.color,
          // Unchanged is left out; a removed icon is sent as an explicit null.
          icon: input.icon === (wallet.icon ?? null) ? undefined : input.icon,
          currentBalance: balanceChange(wallet, input.currentBalance),
        },
      }),
    onSuccess: (updated, { wallet, input }) => {
      replaceWallets(queryClient, [updated]);
      // A new balance is recorded as a System "Korekta stanu" transaction on
      // the server, which the client cannot place itself: reload the list.
      if (balanceChange(wallet, input.currentBalance) !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: transactionKeys.wallet(wallet.id),
        });
      }
    },
  });
}

export function useDeleteWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wallet: WalletResponse) =>
      api.walletsDestroy({ id: wallet.id }),
    onSuccess: (_, wallet) => {
      queryClient.setQueryData(walletsQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== wallet.id),
      );
      queryClient.removeQueries({
        queryKey: transactionKeys.wallet(wallet.id),
      });
    },
  });
}
