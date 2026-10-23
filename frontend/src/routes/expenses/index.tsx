import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletEditModal } from "@/components/WalletEditModal";
import { DeleteWalletModal } from "@/components/DeleteWalletModal";
import { Button } from "@/design-system";
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

  function openEditForm(wallet: (typeof wallets)[number]) {
    ShowModal(WalletEditModal, { wallet });
  }

  function openDeleteDialog(wallet: (typeof wallets)[number]) {
    ShowModal(DeleteWalletModal, { wallet });
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
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Wydatki</h1>
        </div>
        <WalletSelect />
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
        <p className="py-4 text-[13px] text-muted">Brak portfeli. Utwórz pierwszy portfel.</p>
      ) : (
        <>
          <ul className="flex flex-col" aria-label="Portfele">
            {wallets.map((wallet) => (
              <li className="flex min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]" key={wallet.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-snug text-ink">{wallet.name}</p>
                  <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">
                    {wallet.transactionCount ?? 0}{" "}
                    {(wallet.transactionCount ?? 0) === 1
                      ? "transakcja"
                      : (wallet.transactionCount ?? 0) >= 2 && (wallet.transactionCount ?? 0) <= 4
                        ? "transakcje"
                        : "transakcji"}
                  </small>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    aria-label={`Edytuj portfel: ${wallet.name}`}
                    onClick={() => openEditForm(wallet)}
                  >
                    Edytuj
                  </Button>
                  <Button
                    variant="ghostDanger"
                    aria-label={`Usuń portfel: ${wallet.name}`}
                    onClick={() => openDeleteDialog(wallet)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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