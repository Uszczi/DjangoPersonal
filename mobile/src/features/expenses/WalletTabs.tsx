import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  formatCents,
  toCents,
  totalBalanceCents,
} from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";
import { ALL_WALLETS } from "@personal/shared/stores/walletSelection";

import { WalletMark } from "@/features/expenses/WalletMark";
import { useTheme } from "@/theme";
import { NamedIcon } from "@/ui/NamedIcon";

type WalletTabsProps = {
  wallets: WalletResponse[];
  /** The shown wallet's id, or `ALL_WALLETS`. */
  selectedId: string | undefined;
  onSelect: (walletId: string) => void;
};

/**
 * A horizontal row of wallet cards, like the web's wallet sidebar: first
 * "Wszystkie" for every wallet together, then each wallet with its mark, name,
 * transaction count and balance; the shown one is filled in.
 */
export function WalletTabs({ wallets, selectedId, onSelect }: WalletTabsProps) {
  const { colors } = useTheme();
  const transactionCount = wallets.reduce(
    (sum, wallet) => sum + (wallet.transactionCount ?? 0),
    0,
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 pt-4"
    >
      <WalletTab
        name="Wszystkie"
        mark={
          <NamedIcon
            name="layers"
            fallback="wallet"
            color={colors.icon}
            size={18}
          />
        }
        transactionCount={transactionCount}
        balanceCents={totalBalanceCents(wallets)}
        isActive={selectedId === ALL_WALLETS}
        onPress={() => onSelect(ALL_WALLETS)}
      />
      {wallets.map((wallet) => (
        <WalletTab
          key={wallet.id}
          name={wallet.name}
          mark={<WalletMark wallet={wallet} size={18} />}
          transactionCount={wallet.transactionCount ?? 0}
          balanceCents={toCents(wallet.balance ?? "0")}
          isActive={wallet.id === selectedId}
          onPress={() => onSelect(wallet.id)}
        />
      ))}
    </ScrollView>
  );
}

function WalletTab({
  name,
  mark,
  transactionCount,
  balanceCents,
  isActive,
  onPress,
}: {
  name: string;
  mark: ReactNode;
  transactionCount: number;
  balanceCents: number;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      className={
        isActive
          ? "flex-row items-center gap-2.5 rounded-lg border border-card-line bg-paper px-3 py-2.5"
          : "flex-row items-center gap-2.5 rounded-lg border border-transparent px-3 py-2.5 active:bg-wash"
      }
    >
      <View className="size-9 items-center justify-center rounded-full bg-icon-wash">
        {mark}
      </View>
      <View className="max-w-36">
        <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="font-utility text-[11px] text-muted">
          {transactionCount} transakcji
        </Text>
      </View>
      <Text className="font-utility text-[13px] font-semibold text-ink-soft tabular-nums">
        {formatCents(balanceCents)}
      </Text>
    </Pressable>
  );
}
