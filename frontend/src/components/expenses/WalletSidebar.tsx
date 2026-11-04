import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";

import { DragHandle } from "@/design-system";
import { WalletCreateModal } from "@/components/modals/WalletCreateModal";
import { WalletMark } from "@/components/WalletMark";
import { useSortSensors } from "@/lib/useSortSensors";
import { formatCents, toCents } from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";
import { useMoveWallet } from "@personal/shared/queries/wallets";
import { ShowModal } from "@/stores/modal";

type WalletSidebarProps = {
  wallets: WalletResponse[];
  activeWalletId: string;
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
  const moveWallet = useMoveWallet();
  const sensors = useSortSensors();

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const position = wallets.findIndex((wallet) => wallet.id === over.id);
    if (position === -1) return;
    moveWallet.mutate({ id: String(active.id), position });
  }

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={wallets.map((wallet) => wallet.id)}
            strategy={rectSortingStrategy}
          >
            {wallets.map((wallet) => (
              <SortableWallet
                key={wallet.id}
                wallet={wallet}
                isActive={wallet.id === activeWalletId}
              />
            ))}
          </SortableContext>
        </DndContext>
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

/** One wallet's link, with a handle to drag it elsewhere in the list. */
function SortableWallet({
  wallet,
  isActive,
}: {
  wallet: WalletResponse;
  isActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wallet.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex shrink-0 items-center lg:shrink"
    >
      <DragHandle
        aria-label={`Przeciągnij portfel: ${wallet.name}`}
        className="mx-1"
        {...attributes}
        {...listeners}
      />
      <Link
        to="/expenses/$walletId"
        params={{ walletId: String(wallet.id) }}
        search={(prev) => ({ month: prev.month })}
        aria-current={isActive ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left no-underline transition-colors hover:bg-wash aria-[current]:bg-paper aria-[current]:ring-1 aria-[current]:ring-card-line"
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
    </div>
  );
}
