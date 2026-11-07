import { create } from "zustand";

/** The selection that shows every Wallet together. Wallet ids are UUIDs, so it never names one. */
export const ALL_WALLETS = "all";

/**
 * Which Wallet `/expenses` shows: the last one opened, or `ALL_WALLETS`.
 * Client state only; the Wallets themselves are server state
 * (`queries/wallets`), and a selection that no longer exists falls back to
 * the first Wallet (`validSelection`).
 */
type WalletSelectionState = {
  selectedWalletId: string | null;
  selectWallet: (walletId: string) => void;
};

export const useWalletSelectionStore = create<WalletSelectionState>((set) => ({
  selectedWalletId: null,
  selectWallet: (walletId) => set({ selectedWalletId: walletId }),
}));
