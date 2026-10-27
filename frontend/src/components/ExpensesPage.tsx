import { CategoryPanel } from "@/components/CategoryPanel";
import { WalletCreateModal } from "@/components/modals/WalletCreateModal";
import { WalletView } from "@/components/WalletView";
import {
  Button,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ShowModal } from "@/stores/modal";
import { WALLETS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useWallets, validSelection } from "@personal/shared/queries/wallets";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";

type ExpensesPageProps = {
  /** The wallet named by the URL; without one the page shows the store's selected wallet. */
  walletId?: number;
};

/** The Wydatki page: one wallet at a time, then the category manager. */
export function ExpensesPage({ walletId }: ExpensesPageProps) {
  const { data: wallets = [], isPending, isError } = useWallets();
  const selectedWalletId = useWalletSelectionStore(
    (state) => state.selectedWalletId,
  );

  const shownWalletId = walletId ?? validSelection(wallets, selectedWalletId);
  const wallet = wallets.find((item) => item.id === shownWalletId);

  function openCreateForm() {
    ShowModal(WalletCreateModal);
  }

  if (isPending) {
    return <LoadingStatus>Wczytywanie portfeli…</LoadingStatus>;
  }

  return (
    <>
      <PageHeader
        title="Wydatki"
        actions={
          <Button variant="primary" onClick={openCreateForm}>
            <span aria-hidden="true">+</span>
            Nowy portfel
          </Button>
        }
      />

      {isError && <ErrorMessage>{WALLETS_LOAD_ERROR}</ErrorMessage>}

      {wallets.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">
          Brak portfeli. Utwórz pierwszy portfel.
        </p>
      ) : (
        wallet && <WalletView wallet={wallet} />
      )}
      <CategoryPanel />
    </>
  );
}
