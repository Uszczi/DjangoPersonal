import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useEffect } from "react";

import { WalletSelect } from "@/components/WalletSelect";
import { useWalletsStore } from "@/stores/wallets";

export const Route = createFileRoute("/expenses/$walletId")({
  component: WalletDetailPage,
});

export function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const navigate = useNavigate();
  const wallets = useWalletsStore((state) => state.wallets);
  const isLoading = useWalletsStore((state) => state.isLoading);
  const pageError = useWalletsStore((state) => state.pageError);
  const loadWallets = useWalletsStore((state) => state.loadWallets);

  useEffect(() => {
    if (wallets.length === 0) {
      void loadWallets();
    }
  }, [wallets.length, loadWallets]);

  const wallet = wallets.find(
    (item) => item.id === Number(walletId),
  );

  useEffect(() => {
    if (!isLoading && !pageError && !wallet) {
      navigate({ to: "/expenses" });
    }
  }, [isLoading, pageError, wallet, navigate]);

  if (isLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie portfela…
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="loading-state" role="alert">
        {pageError}
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="loading-state" role="status">
        Przekierowywanie…
      </div>
    );
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>{wallet.name}</h1>
        </div>
        <WalletSelect activeWalletId={wallet.id} />
      </div>
      <p className="task-empty-state">
        Transakcje — wkrótce.
      </p>
    </>
  );
}
