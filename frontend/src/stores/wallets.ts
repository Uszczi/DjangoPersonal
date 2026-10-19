import { create } from "zustand";

import { api } from "@/api";
import { type WalletResponse } from "@/generated/api";
import { createLoadGuard } from "@/stores/loadGuard";

/** What the create modal collects: a name and, optionally, an opening balance. */
export type WalletCreateInput = { name: string; initialBalance: string };

/** What the edit modal collects: a name and the balance the wallet now holds. */
export type WalletUpdateInput = { name: string; currentBalance: string };

type WalletsState = {
  wallets: WalletResponse[];
  isLoading: boolean;
  pageError: string;
  loadWallets: () => Promise<void>;
  createWallet: (input: WalletCreateInput) => Promise<WalletResponse>;
  updateWallet: (
    wallet: WalletResponse,
    input: WalletUpdateInput,
  ) => Promise<WalletResponse>;
  confirmWalletDelete: (wallet: WalletResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

/** Mirror the server's `ordering = ['normalized_name']` for optimistic inserts. */
function sortKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

export const useWalletsStore = create<WalletsState>((set) => ({
  wallets: [],
  isLoading: true,
  pageError: "",

  loadWallets: async () => {
    const requestId = loadGuard.nextRequestId();

    try {
      const loadedWallets = await api.walletsList();
      if (!loadGuard.isLatest(requestId)) return;
      set({ wallets: loadedWallets, pageError: "" });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          pageError:
            "Nie udało się wczytać portfeli. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (loadGuard.isLatest(requestId)) set({ isLoading: false });
    }
  },

  createWallet: async ({ name, initialBalance }) => {
    const createdWallet = await api.walletsCreate({
      walletCreateRequest: {
        name,
        // Omitted when blank, so a wallet without an opening balance sends
        // exactly the name it always did.
        initialBalance: initialBalance.trim() || undefined,
      },
    });
    set((state) => {
      const insertAt = state.wallets.findIndex(
        (item) => sortKey(item.name) > sortKey(createdWallet.name),
      );
      const wallets = [...state.wallets];
      wallets.splice(insertAt === -1 ? wallets.length : insertAt, 0, createdWallet);
      return { wallets };
    });
    return createdWallet;
  },

  updateWallet: async (wallet, { name, currentBalance }) => {
    const updatedWallet = await api.walletsPartialUpdate({
      id: wallet.id,
      patchedWalletRequest: {
        name,
        // Only send the balance when it actually changed, so a plain rename
        // never writes a System correction.
        currentBalance:
          currentBalance === (wallet.balance ?? "")
            ? undefined
            : currentBalance.trim() || undefined,
      },
    });
    set((state) => ({
      wallets: state.wallets.map((item) =>
        item.id === updatedWallet.id ? updatedWallet : item,
      ),
    }));
    return updatedWallet;
  },

  confirmWalletDelete: async (wallet) => {
    await api.walletsDestroy({ id: wallet.id });

    set((state) => ({
      wallets: state.wallets.filter((item) => item.id !== wallet.id),
    }));
  },
}));
