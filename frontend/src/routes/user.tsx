import { createFileRoute } from "@tanstack/react-router";

import { Button, PageHeader, ToggleGroup } from "@/design-system";
import { DeleteAccountModal } from "@/components/modals/DeleteAccountModal";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useThemeStore } from "@personal/shared/stores/theme";
import {
  themePreferenceLabels,
  themePreferences,
} from "@personal/shared/themes";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/user")({
  component: UserPage,
});

function UserPage() {
  const user = useAuthStore((state) => state.user);
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);

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
      <div className="mb-8 grid gap-2">
        <h2 className="m-0 text-[12px] font-semibold text-ink-soft">Motyw</h2>
        <ToggleGroup
          label="Motyw"
          options={themePreferences}
          labels={themePreferenceLabels}
          value={themePreference}
          onChange={setThemePreference}
          className="flex-wrap"
        />
        <small className="text-[11px] text-hint">
          Zapisywany na tym urządzeniu.
        </small>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="danger" onClick={openDeleteDialog}>
          Usuń konto
        </Button>
      </div>
    </section>
  );
}
