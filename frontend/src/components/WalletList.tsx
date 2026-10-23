import { DeleteWalletModal } from "@/components/DeleteWalletModal";
import { WalletColorDot } from "@/components/WalletColorDot";
import { WalletEditModal } from "@/components/WalletEditModal";
import { DeleteButton, EditButton, ListRow, ListRowSubtitle, ListRowTitle } from "@/design-system";
import type { WalletResponse } from "@/generated/api";
import { ShowModal } from "@/stores/modal";

/** Polish plural of "transakcja": 1 transakcja, 2–4 (but not 12–14) transakcje, otherwise transakcji. */
function transactionCountLabel(count: number) {
  if (count === 1) return "transakcja";
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "transakcje";
  }
  return "transakcji";
}

export function WalletList({ wallets }: { wallets: WalletResponse[] }) {
  return (
    <ul className="flex flex-col" aria-label="Portfele">
      {wallets.map((wallet) => (
        <WalletRow key={wallet.id} wallet={wallet} />
      ))}
    </ul>
  );
}

function WalletRow({ wallet }: { wallet: WalletResponse }) {
  const transactionCount = wallet.transactionCount ?? 0;

  return (
    <ListRow>
      <>
        <WalletColorDot color={wallet.color} />
        <div className="min-w-0">
          <ListRowTitle>{wallet.name}</ListRowTitle>
          <ListRowSubtitle>
            {transactionCount} {transactionCountLabel(transactionCount)}
          </ListRowSubtitle>
        </div>
      </>
      <>
        <EditButton
          aria-label={`Edytuj portfel: ${wallet.name}`}
          onClick={() => ShowModal(WalletEditModal, { wallet })}
        />
        <DeleteButton
          aria-label={`Usuń portfel: ${wallet.name}`}
          onClick={() => ShowModal(DeleteWalletModal, { wallet })}
        />
      </>
    </ListRow>
  );
}
