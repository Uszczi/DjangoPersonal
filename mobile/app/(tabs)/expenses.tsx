import { Tabs, router } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import {
  centsToAmount,
  dayOfMonth,
  formatCents,
  monthKeyOf,
  shiftMonth,
  summarizeMonth,
  totalBalanceCents,
  type MonthKey,
} from "@personal/shared/expenseMonth";
import { WALLETS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useCategories } from "@personal/shared/queries/categories";
import { useWalletsMonth } from "@personal/shared/queries/transactions";
import { useWallets, validSelection } from "@personal/shared/queries/wallets";
import {
  ALL_WALLETS,
  useWalletSelectionStore,
} from "@personal/shared/stores/walletSelection";
import { TRANSACTIONS_LOAD_ERROR } from "@personal/shared/transactionList";

import { CategoryBreakdown } from "@/features/expenses/CategoryBreakdown";
import { ExpensesSettingsSheet } from "@/features/expenses/ExpensesSettingsSheet";
import { MonthCalendar } from "@/features/expenses/MonthCalendar";
import { MonthSwitcher } from "@/features/expenses/MonthSwitcher";
import { MonthTotals } from "@/features/expenses/MonthTotals";
import { TransactionRow } from "@/features/expenses/TransactionRow";
import { WalletCard } from "@/features/expenses/WalletCard";
import { WalletTabs } from "@/features/expenses/WalletTabs";
import { common } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { Fab } from "@/ui/Fab";
import { LogoMark } from "@/ui/LogoMark";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { useRefreshOnFocus } from "@/useRefreshOnFocus";

const filterDay = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

/**
 * The web Wydatki page: the wallets, then one wallet's month (or every
 * wallet's together) — its totals, a calendar of daily spending, the
 * transactions and where the money went.
 */
export default function ExpensesScreen() {
  const {
    data: wallets = [],
    isPending: isLoading,
    isError: isWalletsError,
    refetch: refetchWallets,
  } = useWallets();
  const selectedWalletId = useWalletSelectionStore(
    (state) => state.selectedWalletId,
  );
  const selectWallet = useWalletSelectionStore((state) => state.selectWallet);
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [day, setDay] = useState<number | null>(null);
  // `undefined`: every Category; `null`: the uncategorised Expenses.
  const [categoryId, setCategoryId] = useState<string | null | undefined>();

  const shownWalletId = validSelection(wallets, selectedWalletId);
  const wallet = wallets.find((item) => item.id === shownWalletId);
  const showsAll = shownWalletId === ALL_WALLETS;
  const hasMonth = wallet !== undefined || showsAll;
  const walletIds = wallet
    ? [wallet.id]
    : showsAll
      ? wallets.map((item) => item.id)
      : [];
  const current = useWalletsMonth(walletIds, month);
  const previous = useWalletsMonth(walletIds, shiftMonth(month, -1));

  // Balances and categories may have changed in a modal or on another device.
  const reloadOnFocus = useCallback(
    () => Promise.all([refetchWallets(), refetchCategories()]),
    [refetchWallets, refetchCategories],
  );
  useRefreshOnFocus(reloadOnFocus);

  async function refresh() {
    setIsRefreshing(true);
    await Promise.all([
      refetchWallets(),
      refetchCategories(),
      current.refetch(),
    ]);
    setIsRefreshing(false);
  }

  /** Another wallet or month starts without the day and Category filters. */
  function clearFilters() {
    setDay(null);
    setCategoryId(undefined);
  }

  function showWallet(id: string) {
    selectWallet(id);
    clearFilters();
  }

  function showMonth(next: MonthKey) {
    setMonth(next);
    clearFilters();
  }

  const pageError = isWalletsError ? WALLETS_LOAD_ERROR : "";
  const loadError = current.isError ? TRANSACTIONS_LOAD_ERROR : "";
  const transactions = hasMonth ? (current.data ?? []) : [];
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
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const total = totalBalanceCents(wallets);
  const walletNames = showsAll
    ? new Map(wallets.map((item) => [item.id, item.name]))
    : undefined;
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
              (categoryId === null ? undefined : categoriesById.get(categoryId))
                ?.name ?? "Bez kategorii",
            onClear: () => setCategoryId(undefined),
          },
        ]),
  ];

  return (
    <View className={common.screen}>
      <Tabs.Screen
        options={{
          header: () => (
            <ScreenHeader
              left={<LogoMark />}
              title="Wydatki"
              actions={[
                {
                  icon: "settings-outline",
                  accessibilityLabel: "Ustawienia wydatków",
                  onPress: () => setIsSettingsOpen(true),
                },
              ]}
            />
          ),
        }}
      />
      <FlatList
        data={shown}
        keyExtractor={(transaction) => String(transaction.id)}
        contentContainerClassName="pb-24"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (isLoading && wallets.length === 0)}
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View>
            {pageError !== "" && (
              <Text className={common.error}>{pageError}</Text>
            )}
            {wallets.length > 0 && (
              <View className="px-4 pt-4">
                <Text className={common.eyebrow}>RAZEM WE WSZYSTKICH</Text>
                <Text className="font-display text-[22px] font-bold text-ink tabular-nums">
                  {formatCents(total)} zł
                </Text>
              </View>
            )}
            {wallets.length > 0 && (
              <WalletTabs
                wallets={wallets}
                selectedId={shownWalletId ?? undefined}
                onSelect={showWallet}
              />
            )}
            {hasMonth ? (
              <WalletCard wallet={wallet ?? null} />
            ) : (
              !isLoading &&
              pageError === "" && (
                <Text className="p-6 text-center text-xs text-muted">
                  Brak portfeli. Utwórz pierwszy portfel.
                </Text>
              )
            )}
            {/* The first wallet; later ones are added from the settings. */}
            {wallets.length === 0 && !isLoading && pageError === "" && (
              <View className="mx-4 flex-row">
                <Button
                  label="+ Nowy portfel"
                  variant="secondary"
                  onPress={() => router.push("/wallet")}
                />
              </View>
            )}
            {hasMonth && (
              <>
                <MonthSwitcher month={month} onChange={showMonth} />
                <MonthTotals
                  summary={summary}
                  previousExpenseCents={previousSummary?.expenseCents}
                  balance={
                    wallet
                      ? { label: "Saldo portfela", value: wallet.balance }
                      : {
                          label: "Saldo portfeli",
                          value: centsToAmount(total),
                        }
                  }
                />
                <MonthCalendar
                  month={month}
                  summary={summary}
                  selectedDay={day}
                  onSelectDay={setDay}
                />
                <View className="mx-4 mt-5 mb-1 flex-row flex-wrap items-center gap-2">
                  <Text className="mr-auto font-display text-[17px] font-bold text-ink">
                    Transakcje
                  </Text>
                  {filters.map((filter) => (
                    <Pressable
                      key={filter.label}
                      accessibilityRole="button"
                      accessibilityLabel={`Usuń filtr: ${filter.label}`}
                      onPress={filter.onClear}
                      className="rounded-full bg-wash px-3 py-1 active:opacity-60"
                    >
                      <Text className="text-xs text-ink-soft">
                        {filter.label} ✕
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {loadError !== "" && (
              <Text className={common.error}>{loadError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          hasMonth && !current.isPending && !current.isError ? (
            <Text className="p-6 text-center text-xs text-muted">
              {filters.length > 0
                ? "Nic nie pasuje do filtrów."
                : "Brak transakcji w tym miesiącu."}
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          hasMonth ? (
            <CategoryBreakdown
              summary={summary}
              categories={categories}
              selected={categoryId}
              onSelect={setCategoryId}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            category={
              item.categoryId ? categoriesById.get(item.categoryId) : undefined
            }
            walletName={walletNames?.get(item.walletId)}
          />
        )}
      />
      {hasMonth && walletIds.length > 0 && (
        <Fab
          accessibilityLabel="Nowa transakcja"
          onPress={() =>
            router.push({
              pathname: "/transaction",
              params: { walletId: walletIds[0] },
            })
          }
        />
      )}
      {isSettingsOpen && (
        <ExpensesSettingsSheet
          wallet={wallet}
          walletCount={wallets.length}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </View>
  );
}
