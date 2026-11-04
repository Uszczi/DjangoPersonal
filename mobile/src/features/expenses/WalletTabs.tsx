import { Pressable, ScrollView, Text, View } from "react-native";

import { formatCents, toCents } from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";

import { WalletMark } from "@/features/expenses/WalletMark";

type WalletTabsProps = {
  wallets: WalletResponse[];
  selectedId: string | undefined;
  onSelect: (walletId: string) => void;
};

/**
 * A horizontal row of wallet cards, like the web's wallet sidebar: each shows
 * its mark, name, transaction count and balance; the shown wallet is filled in.
 */
export function WalletTabs({ wallets, selectedId, onSelect }: WalletTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 pt-4"
    >
      {wallets.map((wallet) => {
        const isActive = wallet.id === selectedId;
        return (
          <Pressable
            key={wallet.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(wallet.id)}
            className={
              isActive
                ? "flex-row items-center gap-2.5 rounded-lg border border-card-line bg-paper px-3 py-2.5"
                : "flex-row items-center gap-2.5 rounded-lg border border-transparent px-3 py-2.5 active:bg-wash"
            }
          >
            <View className="size-9 items-center justify-center rounded-full bg-icon-wash">
              <WalletMark wallet={wallet} size={18} />
            </View>
            <View className="max-w-36">
              <Text
                className="text-sm font-semibold text-ink"
                numberOfLines={1}
              >
                {wallet.name}
              </Text>
              <Text className="font-utility text-[11px] text-muted">
                {wallet.transactionCount} transakcji
              </Text>
            </View>
            <Text className="font-utility text-[13px] font-semibold text-ink-soft tabular-nums">
              {formatCents(toCents(wallet.balance ?? "0"))}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
