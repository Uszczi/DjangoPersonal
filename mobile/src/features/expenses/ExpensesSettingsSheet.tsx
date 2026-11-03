import { router, type Href } from "expo-router";

import type { WalletResponse } from "@personal/shared/generated/api";

import { Sheet, SheetItem } from "@/ui/Sheet";

/**
 * The Wydatki settings, opened from the header: add a Wallet, edit the shown
 * one, and change the Wallets' order. Each closes the sheet and opens its
 * editor screen.
 */
export function ExpensesSettingsSheet({
  wallet,
  walletCount,
  onClose,
}: {
  /** The shown Wallet; without one there is nothing to edit. */
  wallet: WalletResponse | undefined;
  walletCount: number;
  onClose: () => void;
}) {
  function open(href: Href) {
    onClose();
    router.push(href);
  }

  return (
    <Sheet title="Ustawienia wydatków" onClose={onClose}>
      <SheetItem
        icon="add-circle-outline"
        label="Nowy portfel"
        onPress={() => open("/wallet")}
      />
      {wallet && (
        <SheetItem
          icon="create-outline"
          label={`Edytuj portfel: ${wallet.name}`}
          onPress={() =>
            open({ pathname: "/wallet", params: { walletId: wallet.id } })
          }
        />
      )}
      {walletCount > 1 && (
        <SheetItem
          icon="reorder-three-outline"
          label="Kolejność portfeli"
          onPress={() => open("/wallet-order")}
        />
      )}
    </Sheet>
  );
}
