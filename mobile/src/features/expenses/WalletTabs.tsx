import { Pressable, ScrollView, Text } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { WalletMark } from "@/features/expenses/WalletMark";

type WalletTabsProps = {
  wallets: WalletResponse[];
  selectedId: number | undefined;
  onSelect: (walletId: number) => void;
};

/** A horizontal row of wallet tabs; the shown wallet is filled in. */
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
                ? "flex-row items-center gap-1.5 rounded-[5px] border border-deep-ink bg-deep-ink px-3.5 py-2"
                : "flex-row items-center gap-1.5 rounded-[5px] border border-control-border px-3.5 py-2"
            }
          >
            <WalletMark wallet={wallet} size={16} />
            <Text
              className={
                isActive
                  ? "text-[13px] font-semibold text-on-signal"
                  : "text-[13px] font-semibold text-ink-soft"
              }
            >
              {wallet.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
