import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { WalletCreateModal } from "@/components/WalletCreateModal";
import { Button } from "@/design-system";
import { WalletList } from "@/components/WalletList";
import { WalletSelect } from "@/components/WalletSelect";
import { CategoryPanel } from "@/components/CategoryPanel";
import { ShowModal } from "@/stores/modal";
import { useWalletsStore } from "@/stores/wallets";

export const Route = createFileRoute("/expenses/")({
  component: ExpensesPage,
});

export function ExpensesPage() {
  const wallets = useWalletsStore((state) => state.wallets);
  const isLoading = useWalletsStore((state) => state.isLoading);
  const pageError = useWalletsStore((state) => state.pageError);
  const loadWallets = useWalletsStore((state) => state.loadWallets);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  function openCreateForm() {
    ShowModal(WalletCreateModal);
  }

  if (isLoading) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie portfeli…
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">
            Wydatki
          </h1>
        </div>
        <Button variant="primary" onClick={openCreateForm}>
          <span aria-hidden="true">+</span>
          Nowy portfel
        </Button>
      </div>

      {pageError && (
        <p className="py-4 text-[13px] text-danger" role="alert">
          {pageError}
        </p>
      )}

      {wallets.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">
          Brak portfeli. Utwórz pierwszy portfel.
        </p>
      ) : (
        <>
          <WalletSelect />
          <WalletList wallets={wallets} />
          <div className="mt-4">
            <Button variant="primary" onClick={openCreateForm}>
              <span aria-hidden="true">+</span>
              Nowy portfel
            </Button>
          </div>
        </>
      )}
      <CategoryPanel />
    </>
  );
}
