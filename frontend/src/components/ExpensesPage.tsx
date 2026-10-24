import { useEffect } from "react";

import { CategoryPanel } from "@/components/CategoryPanel";
import { WalletCreateModal } from "@/components/modals/WalletCreateModal";
import { WalletView } from "@/components/WalletView";
import { Button, ErrorMessage, LoadingStatus, PageHeader } from "@/design-system";
import { ShowModal } from "@/stores/modal";
import { useWalletsStore } from "@personal/shared/stores/wallets";

type ExpensesPageProps = {
  /** The wallet named by the URL; without one the page shows the store's selected wallet. */
  walletId?: number;
};

/** The Wydatki page: one wallet at a time, then the category manager. */
export function ExpensesPage({ walletId }: ExpensesPageProps) {
  const wallets = useWalletsStore((state) => state.wallets);
  const isLoading = useWalletsStore((state) => state.isLoading);
  const pageError = useWalletsStore((state) => state.pageError);
  const selectedWalletId = useWalletsStore((state) => state.selectedWalletId);
  const loadWallets = useWalletsStore((state) => state.loadWallets);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const shownWalletId = walletId ?? selectedWalletId;
  const wallet = wallets.find((item) => item.id === shownWalletId);

  function openCreateForm() {
    ShowModal(WalletCreateModal);
  }

  if (isLoading) {
    return (
      <LoadingStatus>
        Wczytywanie portfeli…
      </LoadingStatus>
    );
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

      {pageError && (
        <ErrorMessage>
          {pageError}
        </ErrorMessage>
      )}

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
