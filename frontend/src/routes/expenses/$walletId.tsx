import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ExpensesPage } from "@/components/ExpensesPage";
import { useWalletsStore } from "@/stores/wallets";

export const Route = createFileRoute("/expenses/$walletId")({
  component: WalletDetailPage,
});

/** A wallet deep link: remembers the wallet as selected, so `/expenses` reopens it. */
function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const navigate = useNavigate();
  const wallets = useWalletsStore((state) => state.wallets);
  const isLoading = useWalletsStore((state) => state.isLoading);
  const pageError = useWalletsStore((state) => state.pageError);
  const selectWallet = useWalletsStore((state) => state.selectWallet);

  const wallet = wallets.find((item) => item.id === Number(walletId));
  const activeWalletId = wallet?.id;

  useEffect(() => {
    if (activeWalletId != null) selectWallet(activeWalletId);
  }, [activeWalletId, selectWallet]);

  useEffect(() => {
    if (!isLoading && !pageError && !wallet) {
      navigate({ to: "/expenses" });
    }
  }, [isLoading, pageError, wallet, navigate]);

  if (!isLoading && !pageError && !wallet) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Przekierowywanie…
      </div>
    );
  }

  return <ExpensesPage walletId={Number(walletId)} />;
}
