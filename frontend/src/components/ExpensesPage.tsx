import { useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { CategoryPanel } from "@/components/CategoryPanel";
import { CategoryBreakdown } from "@/components/expenses/CategoryBreakdown";
import { MonthCalendar } from "@/components/expenses/MonthCalendar";
import { MonthSwitcher } from "@/components/expenses/MonthSwitcher";
import { MonthTotals } from "@/components/expenses/MonthTotals";
import { MonthTransactionList } from "@/components/expenses/MonthTransactionList";
import { WalletSidebar } from "@/components/expenses/WalletSidebar";
import { TransactionEditorModal } from "@/components/modals/TransactionEditorModal";
import { WalletCreateModal } from "@/components/modals/WalletCreateModal";
import { WalletEditModal } from "@/components/modals/WalletEditModal";
import {
  Button,
  Drawer,
  ErrorMessage,
  IconButton,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ShowModal } from "@/stores/modal";
import {
  dayOfMonth,
  monthKeyOf,
  shiftMonth,
  summarizeMonth,
  type MonthKey,
} from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";
import { WALLETS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useCategories } from "@personal/shared/queries/categories";
import { useMonthTransactions } from "@personal/shared/queries/transactions";
import { useWallets, validSelection } from "@personal/shared/queries/wallets";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";

type ExpensesPageProps = {
  /** The wallet named by the URL; without one the page shows the store's selected wallet. */
  walletId?: string;
  /** The month from `?month=`; without one, the current month. */
  month?: MonthKey;
};

/**
 * The Wydatki page: the wallets beside one wallet's month — its totals, a
 * calendar of daily spending, where the money went, and the transactions.
 */
export function ExpensesPage({ walletId, month }: ExpensesPageProps) {
  const { data: wallets = [], isPending, isError } = useWallets();
  const selectedWalletId = useWalletSelectionStore(
    (state) => state.selectedWalletId,
  );
  const navigate = useNavigate();
  const [currentMonth] = useState(() => monthKeyOf(new Date()));
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const shownWalletId = walletId ?? validSelection(wallets, selectedWalletId);
  const wallet = wallets.find((item) => item.id === shownWalletId);
  const shownMonth = month ?? currentMonth;

  function showMonth(next: MonthKey) {
    void navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        month: next === currentMonth ? undefined : next,
      }),
    });
  }

  if (isPending) {
    return <LoadingStatus>Wczytywanie portfeli…</LoadingStatus>;
  }

  const categoriesDrawer = categoriesOpen && (
    <Drawer
      title="Kategorie"
      label="Kategorie"
      onClose={() => setCategoriesOpen(false)}
    >
      <CategoryPanel />
    </Drawer>
  );

  if (!wallet) {
    return (
      <>
        <PageHeader
          title="Wydatki"
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setCategoriesOpen(true)}
              >
                Zarządzaj kategoriami
              </Button>
              <Button
                variant="primary"
                onClick={() => ShowModal(WalletCreateModal)}
              >
                <span aria-hidden="true">+</span>
                Nowy portfel
              </Button>
            </>
          }
        />
        {isError && <ErrorMessage>{WALLETS_LOAD_ERROR}</ErrorMessage>}
        {!isError && (
          <p className="py-4 text-[13px] text-muted">
            Brak portfeli. Utwórz pierwszy portfel.
          </p>
        )}
        {categoriesDrawer}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-2 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
      <WalletSidebar
        wallets={wallets}
        activeWalletId={wallet.id}
        onManageCategories={() => setCategoriesOpen(true)}
      />
      {/* Keyed so the day and Category filters start empty for another wallet or month. */}
      <WalletMonth
        key={`${wallet.id}:${shownMonth}`}
        wallet={wallet}
        month={shownMonth}
        onMonthChange={showMonth}
      />
      {categoriesDrawer}
    </div>
  );
}

const filterDay = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

/** One wallet's month: header, totals, calendar, Categories and the transaction list. */
function WalletMonth({
  wallet,
  month,
  onMonthChange,
}: {
  wallet: WalletResponse;
  month: MonthKey;
  onMonthChange: (month: MonthKey) => void;
}) {
  const { data: categories = [] } = useCategories();
  const current = useMonthTransactions(wallet.id, month);
  const previous = useMonthTransactions(wallet.id, shiftMonth(month, -1));
  const [day, setDay] = useState<number | null>(null);
  // `undefined`: every Category; `null`: the uncategorised Expenses.
  const [categoryId, setCategoryId] = useState<string | null | undefined>();

  const transactions = current.data ?? [];
  const summary = summarizeMonth(transactions, month);
  const previousSummary = previous.data
    ? summarizeMonth(previous.data, shiftMonth(month, -1))
    : undefined;
  const shown = transactions.filter(
    (transaction) =>
      (day === null || transaction.date.getDate() === day) &&
      (categoryId === undefined ||
        (transaction.kind === "expense" &&
          transaction.categoryId === categoryId)),
  );
  const filters = [
    ...(day === null
      ? []
      : [
          {
            label: filterDay.format(dayOfMonth(month, day)),
            onClear: () => setDay(null),
          },
        ]),
    ...(categoryId === undefined
      ? []
      : [
          {
            label:
              categories.find((item) => item.id === categoryId)?.name ??
              "Bez kategorii",
            onClear: () => setCategoryId(undefined),
          },
        ]),
  ];

  return (
    <section className="min-w-0" aria-label={`Portfel: ${wallet.name}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">
            {wallet.name}
          </h1>
          <IconButton
            aria-label={`Edytuj portfel: ${wallet.name}`}
            onClick={() => ShowModal(WalletEditModal, { wallet })}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <MonthSwitcher month={month} onChange={onMonthChange} />
          <Button
            variant="primary"
            onClick={() =>
              ShowModal(TransactionEditorModal, { walletId: wallet.id })
            }
          >
            <span aria-hidden="true">+</span>
            Nowa transakcja
          </Button>
        </div>
      </div>

      <MonthTotals
        summary={summary}
        previousExpenseCents={previousSummary?.expenseCents}
        walletBalance={wallet.balance}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:self-start">
          <MonthCalendar
            month={month}
            summary={summary}
            selectedDay={day}
            onSelectDay={setDay}
          />
          <CategoryBreakdown
            summary={summary}
            categories={categories}
            selected={categoryId}
            onSelect={setCategoryId}
          />
        </div>
        <MonthTransactionList
          walletId={wallet.id}
          transactions={shown}
          categories={categories}
          filters={filters}
          isPending={current.isPending}
          isError={current.isError}
        />
      </div>
    </section>
  );
}
