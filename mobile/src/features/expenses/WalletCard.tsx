import { router } from "expo-router";
import { Text, View } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { WalletMark } from "@/features/expenses/WalletMark";
import { useTheme } from "@/theme";
import { card } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { NamedIcon } from "@/ui/NamedIcon";

/**
 * The shown wallet (or every wallet, `null`), like the web's header: its name
 * and a link to the categories (editing it is in the Wydatki settings).
 */
export function WalletCard({ wallet }: { wallet: WalletResponse | null }) {
  const { colors } = useTheme();
  return (
    <View className={card.section}>
      <View className="flex-row items-center gap-2.5">
        {wallet ? (
          <WalletMark wallet={wallet} size={24} />
        ) : (
          <NamedIcon
            name="layers"
            fallback="wallet"
            color={colors.icon}
            size={24}
          />
        )}
        <Text
          className="flex-1 font-display text-[22px] font-bold tracking-[-0.4px] text-ink"
          numberOfLines={1}
        >
          {wallet ? wallet.name : "Wszystkie portfele"}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Button
          label="Kategorie"
          variant="secondary"
          className="flex-none"
          onPress={() => router.push("/categories")}
        />
      </View>
    </View>
  );
}
