import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/design-system";
import { DeleteAccountModal } from "@/components/modals/DeleteAccountModal";
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
    <section aria-labelledby="user-heading">
      <div className="mb-6">
        <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">KONTO</p>
        <h1 id="user-heading" className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-ink">{user?.username}</h1>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="danger" onClick={openDeleteDialog}>
          Usuń konto
        </Button>
      </div>
    </section>
  );
}