import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";

import { WalletCreateModal } from "@/components/modals/WalletCreateModal";
import { WalletMark } from "@/components/WalletMark";
import { formatCents, toCents } from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";
import { ShowModal } from "@/stores/modal";

type WalletSidebarProps = {
  wallets: WalletResponse[];
  activeWalletId: number;
  onManageCategories: () => void;
};

/**
 * Every wallet with its balance and the sum of them all. Each links to its
 * `/expenses/$walletId` route, keeping the shown month. A column on wide
 * screens, a row scrolling sideways on narrow ones.
 */
export function WalletSidebar({
  wallets,
  activeWalletId,
  onManageCategories,
}: WalletSidebarProps) {
  const total = wallets.reduce(
    (sum, wallet) => sum + toCents(wallet.balance ?? "0"),
    0,
  );

  return (
    <aside className="flex items-stretch gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
      <div className="shrink-0 self-center pr-2 lg:mb-3 lg:self-auto lg:px-3">
        <div className="font-utility text-[11px] tracking-[0.08em] text-muted uppercase">
          Razem we wszystkich
        </div>
        <div className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink lg:text-[26px]">
          {formatCents(total)}{" "}
          <span className="text-[14px] text-muted">zł</span>
        </div>
      </div>
      <nav
        aria-label="Wybierz portfel"
        className="flex gap-2 lg:flex-col lg:gap-1"
      >
        {wallets.map((wallet) => (
          <Link
            key={wallet.id}
            to="/expenses/$walletId"
            params={{ walletId: String(wallet.id) }}
            search={(prev) => ({ month: prev.month })}
            aria-current={wallet.id === activeWalletId ? "page" : undefined}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left no-underline transition-colors hover:bg-wash aria-[current]:bg-paper aria-[current]:ring-1 aria-[current]:ring-card-line lg:shrink"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-icon-wash">
              <WalletMark wallet={wallet} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {wallet.name}
              </span>
              <span className="block font-utility text-[12px] text-muted">
                {wallet.transactionCount} transakcji
              </span>
            </span>
            <span className="font-utility text-[13px] font-semibold text-ink-soft">
              {formatCents(toCents(wallet.balance ?? "0"))}
            </span>
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => ShowModal(WalletCreateModal)}
        className="shrink-0 rounded-lg border border-dashed border-control-border px-3 py-3 text-left text-sm text-muted hover:border-control-border-hover hover:text-ink lg:mt-1"
      >
        + Nowy portfel
      </button>
      <button
        type="button"
        onClick={onManageCategories}
        className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-wash lg:mt-6"
      >
        <Settings2 aria-hidden="true" className="size-4" />
        Zarządzaj kategoriami
      </button>
    </aside>
  );
}
