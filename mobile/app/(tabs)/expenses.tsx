import { router } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";

import { WALLETS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useCategories } from "@personal/shared/queries/categories";
import { useWalletTransactions } from "@personal/shared/queries/transactions";
import { useWallets, validSelection } from "@personal/shared/queries/wallets";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";
import { TRANSACTIONS_LOAD_ERROR } from "@personal/shared/transactionList";

import { groupByDay } from "@/features/expenses/groupByDay";
import { TransactionRow } from "@/features/expenses/TransactionRow";
import { WalletCard } from "@/features/expenses/WalletCard";
import { WalletTabs } from "@/features/expenses/WalletTabs";
import { common } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { Fab } from "@/ui/Fab";
import { useRefreshOnFocus } from "@/useRefreshOnFocus";

/** The web Wydatki page: one wallet at a time, its transactions by day. */
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

  const shownWalletId = validSelection(wallets, selectedWalletId);
  const wallet = wallets.find((item) => item.id === shownWalletId);
  const walletId = wallet?.id;
  const transactionsQuery = useWalletTransactions(walletId ?? null);

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
      walletId != null ? transactionsQuery.refetch() : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  }

  function loadMore() {
    if (transactionsQuery.isFetchingNextPage) return;
    void transactionsQuery.fetchNextPage();
  }

  const pageError = isWalletsError ? WALLETS_LOAD_ERROR : "";
  const isLoadingMore = transactionsQuery.isFetchingNextPage;
  const transactions = wallet ? (transactionsQuery.data ?? null) : null;
  const hasMore = transactionsQuery.hasNextPage;
  const sections = groupByDay(transactions ?? []);
  const loadError = transactionsQuery.isError ? TRANSACTIONS_LOAD_ERROR : "";
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );

  return (
    <View className={common.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(transaction) => String(transaction.id)}
        contentContainerClassName="pb-24"
        stickySectionHeadersEnabled={false}
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
              <WalletTabs
                wallets={wallets}
                selectedId={walletId}
                onSelect={selectWallet}
              />
            )}
            {wallet ? (
              <WalletCard wallet={wallet} />
            ) : (
              !isLoading &&
              pageError === "" && (
                <Text className="p-6 text-center text-xs text-muted">
                  Brak portfeli. Utwórz pierwszy portfel.
                </Text>
              )
            )}
            <View className="mx-4 mt-3 flex-row gap-3">
              <Button
                label="+ Nowy portfel"
                variant="secondary"
                onPress={() => router.push("/wallet")}
              />
            </View>
            {loadError !== "" && (
              <Text className={common.error}>{loadError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          wallet && transactions !== null ? (
            <Text className="p-6 text-center text-xs text-muted">
              Brak transakcji. Dodaj pierwszą transakcję.
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          hasMore ? (
            <View className="mx-4 mt-3 flex-row gap-3">
              <Button
                label={isLoadingMore ? "Wczytywanie…" : "Pokaż więcej"}
                variant="secondary"
                disabled={isLoadingMore}
                onPress={loadMore}
              />
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text className="px-4 pt-5 pb-1.5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            category={
              item.categoryId ? categoriesById.get(item.categoryId) : undefined
            }
          />
        )}
      />
      {wallet && (
        <Fab
          accessibilityLabel="Nowa transakcja"
          onPress={() =>
            router.push({
              pathname: "/transaction",
              params: { walletId: wallet.id },
            })
          }
        />
      )}
    </View>
  );
}
