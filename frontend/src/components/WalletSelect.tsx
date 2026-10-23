import { useNavigate } from "@tanstack/react-router";

import { useWalletsStore } from "@/stores/wallets";
import { Field, Select } from "@/design-system";

type WalletSelectProps = {
  /** The wallet highlighted in the select, if one is active. */
  activeWalletId?: number;
};

/**
 * Header select that switches the active wallet by navigating to its
 * `/expenses/$walletId` route. Hidden while there are no wallets to pick.
 */
export function WalletSelect({ activeWalletId }: WalletSelectProps) {
  const navigate = useNavigate();
  const wallets = useWalletsStore((state) => state.wallets);

  if (wallets.length === 0) return null;

  return (
    <Field label="Portfel">
      <Select
        aria-label="Wybierz portfel"
        value={activeWalletId != null ? String(activeWalletId) : ""}
        onChange={(event) => {
          const walletId = event.target.value;
          if (walletId) {
            navigate({ to: "/expenses/$walletId", params: { walletId } });
          }
        }}
      >
        <option value="" disabled>
          Wybierz portfel
        </option>
        {wallets.map((wallet) => (
          <option key={wallet.id} value={String(wallet.id)}>
            {wallet.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
