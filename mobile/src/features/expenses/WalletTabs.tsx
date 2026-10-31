import { Pressable, ScrollView, Text } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { makeStyles } from "../../theme";
import { WalletMark } from "./WalletMark";

type WalletTabsProps = {
  wallets: WalletResponse[];
  selectedId: number | undefined;
  onSelect: (walletId: number) => void;
};

/** A horizontal row of wallet tabs; the shown wallet is filled in. */
export function WalletTabs({ wallets, selectedId, onSelect }: WalletTabsProps) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.walletTabs}
    >
      {wallets.map((wallet) => {
        const isActive = wallet.id === selectedId;
        return (
          <Pressable
            key={wallet.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(wallet.id)}
            style={[styles.walletTab, isActive && styles.walletTabActive]}
          >
            <WalletMark wallet={wallet} size={16} />
            <Text
              style={[
                styles.walletTabLabel,
                isActive && styles.walletTabLabelActive,
              ]}
            >
              {wallet.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  walletTabs: { gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  walletTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletTabActive: {
    borderColor: colors.deepInk,
    backgroundColor: colors.deepInk,
  },
  walletTabLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: "600" },
  walletTabLabelActive: { color: colors.onSignal },
}));
