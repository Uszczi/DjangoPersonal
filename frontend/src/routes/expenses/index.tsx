import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletEditModal } from "@/components/WalletEditModal";
import { DeleteWalletModal } from "@/components/DeleteWalletModal";
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
        <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" onClick={openCreateForm}>
          <span aria-hidden="true">+</span>
          Nowy portfel
        </button>
      </div>

      {pageError && (
        <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
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
                  <button
                    className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
                    type="button"
                    aria-label={`Edytuj portfel: ${wallet.name}`}
                    onClick={() => openEditForm(wallet)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#a23a28] transition-all hover:bg-[#f5e3dc] hover:text-[#872d1e]"
                    type="button"
                    aria-label={`Usuń portfel: ${wallet.name}`}
                    onClick={() => openDeleteDialog(wallet)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" onClick={openCreateForm}>
              <span aria-hidden="true">+</span>
              Nowy portfel
            </button>
          </div>
        </>
      )}
      <CategoryPanel />
    </>
  );
}