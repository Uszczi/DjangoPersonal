import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useAuthStore } from "@personal/shared/stores/auth";

import { Button } from "../../src/Button";
import { confirmDestructive } from "../../src/confirm";
import { card, common, form } from "../../src/theme";

export default function AccountScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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
    <ScrollView style={common.screen}>
      <View style={card.section}>
        <Text style={card.kicker}>KONTO</Text>
        <Text style={card.title}>{user?.username}</Text>
      </View>
      <View style={[card.section, { gap: 12 }]}>
        <View style={{ flexDirection: "row" }}>
          <Button label="Wyloguj" variant="secondary" disabled={isDeleting} onPress={logout} />
        </View>
        <View style={{ flexDirection: "row" }}>
          <Button
            label="Usuń konto"
            variant="danger"
            isBusy={isDeleting}
            onPress={() => void deleteAccount()}
          />
        </View>
        {deleteError !== "" && <Text style={form.error}>{deleteError}</Text>}
      </View>
    </ScrollView>
  );
}
