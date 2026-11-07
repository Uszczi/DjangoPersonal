import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

import { ExpensesPage } from "@/components/ExpensesPage";
import {
  ALL_WALLETS,
  useWalletSelectionStore,
} from "@personal/shared/stores/walletSelection";

export const Route = createFileRoute("/expenses/all")({
  component: AllWalletsPage,
});

const expensesRoute = getRouteApi("/expenses");

/** Every wallet together; remembered as the selection, so `/expenses` reopens it. */
function AllWalletsPage() {
  const { month } = expensesRoute.useSearch();
  const selectWallet = useWalletSelectionStore((state) => state.selectWallet);

  useEffect(() => {
    selectWallet(ALL_WALLETS);
  }, [selectWallet]);

  return <ExpensesPage walletId={ALL_WALLETS} month={month} />;
}
