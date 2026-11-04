import { create } from "zustand";

/**
 * Which Wallet `/expenses` shows: the last one opened. Client state only; the
 * Wallets themselves are server state (`queries/wallets`), and a selection
 * that no longer exists falls back to the first Wallet (`validSelection`).
 */
type WalletSelectionState = {
  selectedWalletId: string | null;
  selectWallet: (walletId: string) => void;
};

export const useWalletSelectionStore = create<WalletSelectionState>((set) => ({
  selectedWalletId: null,
  selectWallet: (walletId) => set({ selectedWalletId: walletId }),
}));
