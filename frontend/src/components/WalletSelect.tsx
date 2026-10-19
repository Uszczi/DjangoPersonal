import { useNavigate } from "@tanstack/react-router";

import { useWalletsStore } from "@/stores/wallets";

type WalletSelectProps = {
  /** The wallet highlighted in the select, if one is active. */
  activeWalletId?: number;
};

/**
 * Header select that switches the active wallet by navigating to its
 * `/expenses/$walletId` route. Hidden while there are no wallets to pick.
 */
export function WalletSelect({ activeWalletId }: WalletSelectProps) {
  const navigate = useNavigate();
  const wallets = useWalletsStore((state) => state.wallets);

  if (wallets.length === 0) return null;

  return (
    <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
      <span>Portfel</span>
      <select
        className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
        aria-label="Wybierz portfel"
        value={activeWalletId != null ? String(activeWalletId) : ""}
        onChange={(event) => {
          const walletId = event.target.value;
          if (walletId) {
            navigate({ to: "/expenses/$walletId", params: { walletId } });
          }
        }}
      >
        <option value="" disabled>
          Wybierz portfel
        </option>
        {wallets.map((wallet) => (
          <option key={wallet.id} value={String(wallet.id)}>
            {wallet.name}
          </option>
        ))}
      </select>
    </label>
  );
}
