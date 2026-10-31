import { router } from "expo-router";
import { Text, View } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { card } from "../../ui/classes";
import { Button } from "../../ui/Button";
import { WalletMark } from "./WalletMark";

/** The shown wallet: its name and balance, with links to edit it and the categories. */
export function WalletCard({ wallet }: { wallet: WalletResponse }) {
  return (
    <View className={card.section}>
      <View className="flex-row items-center gap-2.5">
        <WalletMark wallet={wallet} size={24} />
        <Text
          className="flex-1 font-display text-[22px] font-bold tracking-[-0.4px] text-ink"
          numberOfLines={1}
        >
          {wallet.name}
        </Text>
        {wallet.balance != null && (
          <Text className="font-utility text-[18px] font-bold text-ink tabular-nums">
            {wallet.balance}
          </Text>
        )}
      </View>
      <View className="flex-row gap-3">
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
  );
}
