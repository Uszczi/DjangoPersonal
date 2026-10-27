import { createFileRoute } from "@tanstack/react-router";

import { Button, PageHeader } from "@/design-system";
import { DeleteAccountModal } from "@/components/modals/DeleteAccountModal";
import { useAuthStore } from "@personal/shared/stores/auth";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/user")({
  component: UserPage,
});

function UserPage() {
  const user = useAuthStore((state) => state.user);

  function openDeleteDialog() {
    ShowModal(DeleteAccountModal);
  }

  return (
    <section aria-labelledby="user-heading">
      <PageHeader
        eyebrow="KONTO"
        title={user?.username}
        titleId="user-heading"
      />
      <div className="flex items-center gap-4">
        <Button variant="danger" onClick={openDeleteDialog}>
          Usuń konto
        </Button>
      </div>
    </section>
  );
}
