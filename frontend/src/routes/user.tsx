import { createFileRoute } from "@tanstack/react-router";

import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { useAuthStore } from "@/stores/auth";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/user")({
  component: UserPage,
});

export function UserPage() {
  const user = useAuthStore((state) => state.user);

  function openDeleteDialog() {
    ShowModal(DeleteAccountModal);
  }

  return (
    <section className="user-section" aria-labelledby="user-heading">
      <div className="user-heading">
        <p className="eyebrow">KONTO</p>
        <h1 id="user-heading">{user?.username}</h1>
      </div>
      <div className="user-actions">
        <button className="danger-button" type="button" onClick={openDeleteDialog}>
          Usuń konto
        </button>
      </div>
    </section>
  );
}
