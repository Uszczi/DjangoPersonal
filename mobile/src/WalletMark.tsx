import { View } from "react-native";

import type { WalletResponse } from "@personal/shared/generated/api";

import { NamedIcon } from "./NamedIcon";

type WalletMarkProps = { wallet: Pick<WalletResponse, "color" | "icon">; size?: number };

/** The wallet's icon in its colour, or a colour dot when it has none (like the web). */
export function WalletMark({ wallet, size = 20 }: WalletMarkProps) {
  if (wallet.icon) {
    return <NamedIcon name={wallet.icon} fallback="wallet" color={wallet.color} size={size} />;
  }
  const dot = Math.round(size * 0.6);
  return (
    <View
      style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: wallet.color }}
    />
  );
}
