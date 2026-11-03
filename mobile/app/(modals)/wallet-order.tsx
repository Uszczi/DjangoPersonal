import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { formatCents, toCents } from "@personal/shared/expenseMonth";
import type { WalletResponse } from "@personal/shared/generated/api";
import { useMoveWallet, useWallets } from "@personal/shared/queries/wallets";

import { WalletMark } from "@/features/expenses/WalletMark";
import { useTheme } from "@/theme";
import { common } from "@/ui/classes";

/**
 * The order of the Wallets in Wydatki. A long press drags a Wallet to another
 * place, like the statuses in the Project editor; the wallet row on Wydatki
 * scrolls sideways, which the reorderable list cannot drag in, hence a screen.
 */
export default function WalletOrderScreen() {
  const { data: wallets = [] } = useWallets();
  const moveWallet = useMoveWallet();
  const [error, setError] = useState("");

  function reorder({ from, to }: ReorderableListReorderEvent) {
    const wallet = wallets[from];
    if (!wallet || from === to) return;
    setError("");
    // The cached list moves at once; a refused move snaps back on reload.
    moveWallet.mutate(
      { id: wallet.id, position: to },
      {
        onError: async (failure) => setError(await apiErrorMessage(failure)),
      },
    );
  }

  return (
    <View className={common.screen}>
      <Text className="mx-4 mt-4 text-[11px] text-hint">
        Przytrzymaj portfel, aby zmienić jego miejsce.
      </Text>
      {error !== "" && <Text className={common.error}>{error}</Text>}
      <ReorderableList
        data={wallets}
        keyExtractor={(wallet) => String(wallet.id)}
        onReorder={reorder}
        renderItem={({ item }) => <WalletRow wallet={item} />}
      />
    </View>
  );
}

function WalletRow({ wallet }: { wallet: WalletResponse }) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  return (
    <Pressable
      // A dragged row floats over its neighbours, so it needs its own fill.
      className="mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line bg-canvas px-[3px] py-2.5"
      accessibilityLabel={wallet.name}
      accessibilityHint="Przytrzymaj, aby zmienić kolejność"
      onLongPress={drag}
    >
      <View className="size-9 items-center justify-center rounded-full bg-icon-wash">
        <WalletMark wallet={wallet} size={18} />
      </View>
      <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
        {wallet.name}
      </Text>
      <Text className="font-utility text-[13px] font-semibold text-ink-soft tabular-nums">
        {formatCents(toCents(wallet.balance ?? "0"))}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Przenieś portfel ${wallet.name}`}
        accessibilityHint="Przytrzymaj i przeciągnij, aby zmienić kolejność"
        hitSlop={8}
        delayLongPress={150}
        onLongPress={drag}
        className="h-[34px] w-7 items-center justify-center"
      >
        <Ionicons name="reorder-three" size={22} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}
