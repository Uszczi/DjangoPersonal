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
    <section className="p-8" aria-labelledby="user-heading">
      <div className="mb-6">
        <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">KONTO</p>
        <h1 id="user-heading" className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] text-ink">{user?.username}</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-[5px] border border-transparent bg-[#a23a28] px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#872d1e] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" type="button" onClick={openDeleteDialog}>
          Usuń konto
        </button>
      </div>
    </section>
  );
}