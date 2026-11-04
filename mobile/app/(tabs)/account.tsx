import { useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { ScrollViewContainer } from "react-native-reorderable-list";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useUpdateTheme } from "@personal/shared/queries/settings";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useThemeStore } from "@personal/shared/stores/theme";
import {
  themePreferenceLabels,
  themePreferences,
} from "@personal/shared/themes";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { confirmDestructive } from "@/ui/confirm";
import { TabBarSettings } from "@/features/tabs/TabBarSettings";
import { useNotificationPermission } from "@/features/time/notificationPermission";
import { useTimerNotificationSettingsStore } from "@/features/time/timerNotificationSettings";
import { useTheme } from "@/theme";
import { card, common, form } from "@/ui/classes";

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const themePreference = useThemeStore((state) => state.preference);
  const updateTheme = useUpdateTheme();
  const { colors } = useTheme();
  const showOngoing = useTimerNotificationSettingsStore(
    (state) => state.showOngoing,
  );
  const setShowOngoing = useTimerNotificationSettingsStore(
    (state) => state.setShowOngoing,
  );
  const notificationPermission = useNotificationPermission();

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
    // The Tab bar settings drag their rows: a nested reorderable list needs
    // this container instead of a ScrollView (no className, hence the View).
    <View className={common.screen}>
      <ScrollViewContainer>
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
        <View className={card.section}>
          <Text className={card.kicker}>POWIADOMIENIA</Text>
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 text-[15px] font-medium text-ink">
              Powiadomienie o aktywnym timerze
            </Text>
            <Switch
              accessibilityLabel="Powiadomienie o aktywnym timerze"
              value={showOngoing}
              onValueChange={setShowOngoing}
              trackColor={{ true: colors.signal, false: colors.controlBorder }}
            />
          </View>
          <Text className={form.hint}>
            {Platform.OS === "ios"
              ? "Widoczne, dopóki timer działa. Zapisywane na tym urządzeniu."
              : "Zostaje na pasku powiadomień, dopóki timer działa. Zapisywane na tym urządzeniu."}
          </Text>
          {notificationPermission.granted === false && (
            <>
              <Text className={form.error}>
                Brak zgody na powiadomienia: telefon nie pokaże ani aktywnego
                timera, ani końca odliczania.
              </Text>
              <View className="flex-row">
                <Button
                  label="Zezwól na powiadomienia"
                  variant="secondary"
                  onPress={() => void notificationPermission.request()}
                />
              </View>
            </>
          )}
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
      </ScrollViewContainer>
    </View>
  );
}
