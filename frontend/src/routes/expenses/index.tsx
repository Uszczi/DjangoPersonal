import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { WalletEditorModal } from "@/components/WalletEditorModal";
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
    ShowModal(WalletEditorModal);
  }

  function openEditForm(wallet: (typeof wallets)[number]) {
    ShowModal(WalletEditorModal, { wallet });
  }

  function openDeleteDialog(wallet: (typeof wallets)[number]) {
    ShowModal(DeleteWalletModal, { wallet });
  }

  if (isLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie portfeli…
      </div>
    );
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Wydatki</h1>
        </div>
        <WalletSelect />
        <button className="primary-button" onClick={openCreateForm}>
          <span aria-hidden="true">+</span>
          Nowy portfel
        </button>
      </div>

      {pageError && (
        <p className="task-error" role="alert">
          {pageError}
        </p>
      )}

      {wallets.length === 0 ? (
        <p className="task-empty-state">Brak portfeli. Utwórz pierwszy portfel.</p>
      ) : (
        <>
          <ul className="project-list" aria-label="Portfele">
            {wallets.map((wallet) => (
              <li className="project-row" key={wallet.id}>
                <div className="project-row-copy">
                  <p>{wallet.name}</p>
                  <small>
                    {wallet.transactionCount ?? 0}{" "}
                    {(wallet.transactionCount ?? 0) === 1
                      ? "transakcja"
                      : (wallet.transactionCount ?? 0) >= 2 && (wallet.transactionCount ?? 0) <= 4
                        ? "transakcje"
                        : "transakcji"}
                  </small>
                </div>
                <div className="project-row-actions">
                  <button
                    className="task-edit-button"
                    type="button"
                    aria-label={`Edytuj portfel: ${wallet.name}`}
                    onClick={() => openEditForm(wallet)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="task-delete-button"
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
          <div className="list-add-row">
            <button className="primary-button" onClick={openCreateForm}>
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
