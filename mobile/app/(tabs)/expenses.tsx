import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import type { TransactionResponse } from "@personal/shared/generated/api";
import { WALLETS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useCategories } from "@personal/shared/queries/categories";
import { useWalletTransactions } from "@personal/shared/queries/transactions";
import { useWallets, validSelection } from "@personal/shared/queries/wallets";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";
import { TRANSACTIONS_LOAD_ERROR } from "@personal/shared/transactionList";
import { dateKey } from "@personal/shared/timeFormat";

import { Button } from "../../src/Button";
import { Fab } from "../../src/Fab";
import { NamedIcon } from "../../src/NamedIcon";
import { WalletMark } from "../../src/WalletMark";
import { card, colors, common } from "../../src/theme";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type DaySection = { title: string; data: TransactionResponse[] };

/** Consecutive transactions grouped by calendar day, keeping the newest-first order. */
function groupByDay(transactions: TransactionResponse[]): DaySection[] {
  const groups = new Map<string, TransactionResponse[]>();
  for (const transaction of transactions) {
    const key = dateKey(transaction.date);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.values()].map((data) => ({
    title: dayFormatter.format(data[0].date),
    data,
  }));
}

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

  return (
    <View style={common.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(transaction) => String(transaction.id)}
        contentContainerStyle={{ paddingBottom: 96 }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (isLoading && wallets.length === 0)}
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View>
            {pageError !== "" && <Text style={common.error}>{pageError}</Text>}
            {wallets.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletTabs}
              >
                {wallets.map((item) => {
                  const isActive = item.id === walletId;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      onPress={() => selectWallet(item.id)}
                      style={[
                        styles.walletTab,
                        isActive && styles.walletTabActive,
                      ]}
                    >
                      <WalletMark wallet={item} size={16} />
                      <Text
                        style={[
                          styles.walletTabLabel,
                          isActive && styles.walletTabLabelActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {wallet ? (
              <View style={card.section}>
                <View style={styles.walletHeader}>
                  <WalletMark wallet={wallet} size={24} />
                  <Text style={[card.title, { flex: 1 }]} numberOfLines={1}>
                    {wallet.name}
                  </Text>
                  {wallet.balance != null && (
                    <Text style={styles.balance}>{wallet.balance}</Text>
                  )}
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Edytuj portfel"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/wallet",
                        params: { walletId: wallet.id },
                      })
                    }
                  />
                  <Button
                    label="Kategorie"
                    variant="secondary"
                    onPress={() => router.push("/categories")}
                  />
                </View>
              </View>
            ) : (
              !isLoading &&
              pageError === "" && (
                <Text style={[common.muted, styles.empty]}>
                  Brak portfeli. Utwórz pierwszy portfel.
                </Text>
              )
            )}
            <View
              style={[styles.actions, { marginHorizontal: 16, marginTop: 12 }]}
            >
              <Button
                label="+ Nowy portfel"
                variant="secondary"
                onPress={() => router.push("/wallet")}
              />
            </View>
            {loadError !== "" && <Text style={common.error}>{loadError}</Text>}
          </View>
        }
        ListEmptyComponent={
          wallet && transactions !== null ? (
            <Text style={[common.muted, styles.empty]}>
              Brak transakcji. Dodaj pierwszą transakcję.
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          hasMore ? (
            <View
              style={[styles.actions, { marginHorizontal: 16, marginTop: 12 }]}
            >
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
          <Text style={styles.dayTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const category = item.categoryId
            ? categories.find((candidate) => candidate.id === item.categoryId)
            : undefined;
          return (
            <Pressable
              style={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj transakcję: ${item.title}`}
              onPress={() =>
                router.push({
                  pathname: "/transaction",
                  params: { walletId: item.walletId, transactionId: item.id },
                })
              }
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title}>{item.title}</Text>
                {item.description !== "" && (
                  <Text style={common.muted} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                {category && (
                  <View style={styles.category}>
                    <NamedIcon
                      name={category.icon}
                      fallback={DEFAULT_CATEGORY_ICON}
                      size={14}
                      color={colors.muted}
                    />
                    <Text style={common.muted}>{category.name}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.amount}>{item.amount}</Text>
            </Pressable>
          );
        }}
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

const styles = StyleSheet.create({
  walletTabs: { gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  walletTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletTabActive: { borderColor: colors.text },
  walletTabLabel: { color: colors.text },
  walletTabLabelActive: { fontWeight: "700" },
  walletHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  balance: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  actions: { flexDirection: "row", gap: 12 },
  empty: { padding: 24, textAlign: "center" },
  dayTitle: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  title: { fontSize: 16, color: colors.text },
  category: { flexDirection: "row", alignItems: "center", gap: 4 },
  amount: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
