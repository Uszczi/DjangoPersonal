import { Link } from "@tanstack/react-router";

import { WalletMark } from "@/components/WalletMark";
import { useWalletsStore } from "@personal/shared/stores/wallets";

type WalletSelectProps = {
  /** The wallet highlighted in the list, if one is active. */
  activeWalletId?: number;
};

/**
 * Switches the active wallet: the wallets side by side in one row (scrolling
 * sideways when they do not fit), each its colour and name linking to its
 * `/expenses/$walletId` route. Hidden while there are no wallets.
 */
export function WalletSelect({ activeWalletId }: WalletSelectProps) {
  const wallets = useWalletsStore((state) => state.wallets);

  if (wallets.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Wybierz portfel">
      {wallets.map((wallet) => (
        <Link
          key={wallet.id}
          to="/expenses/$walletId"
          params={{ walletId: String(wallet.id) }}
          aria-current={wallet.id === activeWalletId ? "page" : undefined}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded px-[11px] py-[6px] text-sm text-ink-soft no-underline transition-colors hover:bg-wash hover:text-ink aria-[current]:bg-wash aria-[current]:font-semibold aria-[current]:text-ink"
        >
          <WalletMark wallet={wallet} />
          <span>{wallet.name}</span>
        </Link>
      ))}
    </nav>
  );
}
