import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ExpensesPage } from "@/components/ExpensesPage";
import { useWallets } from "@personal/shared/queries/wallets";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";
import { LoadingStatus } from "@/design-system";

export const Route = createFileRoute("/expenses/$walletId")({
  component: WalletDetailPage,
});

/** A wallet deep link: remembers the wallet as selected, so `/expenses` reopens it. */
function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const navigate = useNavigate();
  const { data: wallets = [], isPending: isLoading, isError } = useWallets();
  const selectWallet = useWalletSelectionStore((state) => state.selectWallet);

  const wallet = wallets.find((item) => item.id === Number(walletId));
  const activeWalletId = wallet?.id;

  useEffect(() => {
    if (activeWalletId != null) selectWallet(activeWalletId);
  }, [activeWalletId, selectWallet]);

  useEffect(() => {
    if (!isLoading && !isError && !wallet) {
      navigate({ to: "/expenses" });
    }
  }, [isLoading, isError, wallet, navigate]);

  if (!isLoading && !isError && !wallet) {
    return <LoadingStatus>Przekierowywanie…</LoadingStatus>;
  }

  return <ExpensesPage walletId={Number(walletId)} />;
}
