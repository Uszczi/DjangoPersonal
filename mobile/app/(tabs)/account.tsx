import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useUpdateTheme } from "@personal/shared/queries/settings";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useThemeStore } from "@personal/shared/stores/theme";
import {
  themePreferenceLabels,
  themePreferences,
} from "@personal/shared/themes";

import { Button } from "../../src/ui/Button";
import { ChipGroup } from "../../src/ui/ChipGroup";
import { confirmDestructive } from "../../src/ui/confirm";
import { TabBarSettings } from "../../src/features/tabs/TabBarSettings";
import { card, common, form } from "../../src/ui/classes";

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const themePreference = useThemeStore((state) => state.preference);
  const updateTheme = useUpdateTheme();

  async function deleteAccount() {
    const confirmed = await confirmDestructive(
      "Usunąć konto?",
      `Konto „${user?.username ?? ""}” wraz z wszystkimi danymi zostanie trwale usunięte. Tej operacji nie można cofnąć.`,
      "Usuń konto",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError("");
    try {
      await api.authDestroy();
      // The root layout's guard switches to the login screen.
      logout();
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
      setIsDeleting(false);
    }
  }

  return (
    <ScrollView className={common.screen}>
      <View className={card.section}>
        <Text className={common.eyebrow}>KONTO</Text>
        <Text className={common.pageTitle}>{user?.username}</Text>
      </View>
      <View className={card.section}>
        <Text className={card.kicker}>MOTYW</Text>
        <ChipGroup
          options={themePreferences.map((value) => ({
            value,
            label: themePreferenceLabels[value],
          }))}
          value={themePreference}
          onChange={(theme) => updateTheme.mutate(theme)}
        />
        {updateTheme.isError && (
          <Text className={form.error}>
            Nie udało się zapisać motywu. Spróbuj ponownie.
          </Text>
        )}
        <Text className={form.hint}>
          Zapisywany na koncie, wspólny dla wszystkich urządzeń.
        </Text>
      </View>
      <TabBarSettings />
      <View className="mx-4 mt-4 gap-3 rounded-lg border border-card-line bg-paper p-5 shadow-[0_8px_18px_rgba(29,55,57,0.06)]">
        <View className="flex-row">
          <Button
            label="Wyloguj"
            variant="secondary"
            disabled={isDeleting}
            onPress={logout}
          />
        </View>
        <View className="flex-row">
          <Button
            label="Usuń konto"
            variant="danger"
            isBusy={isDeleting}
            onPress={() => void deleteAccount()}
          />
        </View>
        {deleteError !== "" && (
          <Text className={form.error}>{deleteError}</Text>
        )}
      </View>
    </ScrollView>
  );
}
