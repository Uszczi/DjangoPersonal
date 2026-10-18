import { create } from "zustand";

import { api } from "@/api";
import { type WalletResponse } from "@/generated/api";
import { createLoadGuard } from "@/stores/loadGuard";

export type WalletInput = { name: string };

type WalletsState = {
  wallets: WalletResponse[];
  isLoading: boolean;
  pageError: string;
  loadWallets: () => Promise<void>;
  saveWallet: (
    input: WalletInput,
    wallet?: WalletResponse | null,
  ) => Promise<WalletResponse>;
  confirmWalletDelete: (wallet: WalletResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

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

  saveWallet: async (input, wallet) => {
    if (wallet) {
      const updatedWallet = await api.walletsPartialUpdate({
        id: wallet.id,
        patchedWalletRequest: input,
      });
      set((state) => ({
        wallets: state.wallets.map((item) =>
          item.id === updatedWallet.id ? updatedWallet : item,
        ),
      }));
      return updatedWallet;
    }

    const createdWallet = await api.walletsCreate({
      walletRequest: input,
    });
    set((state) => {
      // Mirror the server's `ordering = ['normalized_name']` so the optimistic
      // insert lands where a reload would put it.
      const key = (name: string) => name.trim().toLocaleLowerCase();
      const insertAt = state.wallets.findIndex(
        (item) => key(item.name) > key(createdWallet.name),
      );
      const wallets = [...state.wallets];
      wallets.splice(insertAt === -1 ? wallets.length : insertAt, 0, createdWallet);
      return { wallets };
    });
    return createdWallet;
  },

  confirmWalletDelete: async (wallet) => {
    await api.walletsDestroy({ id: wallet.id });

    set((state) => ({
      wallets: state.wallets.filter((item) => item.id !== wallet.id),
    }));
  },
}));
