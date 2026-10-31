import type { WalletResponse } from "@personal/shared/generated/api";
import { NamedIcon } from "@/design-system";
import { ColorDot } from "@/components/ColorDot";

type WalletMarkProps = {
  wallet: Pick<WalletResponse, "color" | "icon">;
  className?: string;
};

/**
 * What stands next to a wallet's name: its icon drawn in the wallet's colour,
 * or the colour dot when it has no icon. Decorative; the name carries the meaning.
 */
export function WalletMark({ wallet, className = "" }: WalletMarkProps) {
  if (!wallet.icon)
    return <ColorDot color={wallet.color} className={className} />;
  return (
    <span
      className={`inline-flex shrink-0 ${className}`.trim()}
      style={{ color: wallet.color }}
    >
      <NamedIcon name={wallet.icon} fallback="wallet" />
    </span>
  );
}
