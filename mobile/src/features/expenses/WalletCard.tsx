import { router } from "expo-router";
import { Text, View } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { fonts, makeStyles, useTheme } from "../../theme";
import { Button } from "../../ui/Button";
import { WalletMark } from "./WalletMark";

/** The shown wallet: its name and balance, with links to edit it and the categories. */
export function WalletCard({ wallet }: { wallet: WalletResponse }) {
  const { card } = useTheme();
  const styles = useStyles();
  return (
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
  );
}

const useStyles = makeStyles((colors) => ({
  walletHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  balance: {
    fontFamily: fonts.utility,
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  actions: { flexDirection: "row", gap: 12 },
}));
