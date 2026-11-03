import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { WalletMark } from "@/features/expenses/WalletMark";
import { useTheme } from "@/theme";
import { card } from "@/ui/classes";
import { Button } from "@/ui/Button";
import { NamedIcon } from "@/ui/NamedIcon";

/** The shown wallet, like the web's header: its name with a pencil to edit it, and a link to the categories. */
export function WalletCard({ wallet }: { wallet: WalletResponse }) {
  const { colors } = useTheme();
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edytuj portfel: ${wallet.name}`}
          hitSlop={8}
          onPress={() =>
            router.push({
              pathname: "/wallet",
              params: { walletId: wallet.id },
            })
          }
          className="size-9 items-center justify-center rounded-lg active:bg-wash"
        >
          <NamedIcon
            name="pencil"
            fallback="pencil"
            size={16}
            color={colors.inkSoft}
          />
        </Pressable>
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
