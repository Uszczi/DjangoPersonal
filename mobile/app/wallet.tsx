import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { balanceError } from "@personal/shared/money";
import { useWalletsStore } from "@personal/shared/stores/wallets";
import { DEFAULT_WALLET_COLOR } from "@personal/shared/walletColors";
import { WALLET_ICON_SUGGESTIONS } from "@personal/shared/walletIcons";

import { Button } from "../src/Button";
import { ColorPicker } from "../src/ColorPicker";
import { confirmDestructive } from "../src/confirm";
import { IconPicker } from "../src/IconPicker";
import { common, form } from "../src/theme";

/**
 * Creates a Wallet (with an opening balance), or edits one (`?walletId=`):
 * name, colour, icon and the balance it now holds. A changed balance is
 * recorded by the server as a System correction.
 */
export default function WalletEditorScreen() {
  const params = useLocalSearchParams<{ walletId?: string }>();
  const walletId = params.walletId ? Number(params.walletId) : null;
  const wallet = useWalletsStore((state) =>
    walletId === null ? null : (state.wallets.find((item) => item.id === walletId) ?? null),
  );
  const createWallet = useWalletsStore((state) => state.createWallet);
  const updateWallet = useWalletsStore((state) => state.updateWallet);
  const confirmWalletDelete = useWalletsStore((state) => state.confirmWalletDelete);

  const [name, setName] = useState(wallet?.name ?? "");
  const [color, setColor] = useState<string>(wallet?.color ?? DEFAULT_WALLET_COLOR);
  const [icon, setIcon] = useState<string | null>(wallet?.icon ?? null);
  const [balance, setBalance] = useState(wallet ? (wallet.balance ?? "0.00") : "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (walletId !== null && !wallet) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono portfela.</Text>
      </View>
    );
  }

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Podaj nazwę portfela.");
      return;
    }
    // Accept a decimal comma from the phone keyboard.
    const normalizedBalance = balance.trim().replace(",", ".");
    const balanceProblem = balanceError(normalizedBalance);
    if (balanceProblem) {
      setFormError(balanceProblem);
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (wallet) {
        await updateWallet(wallet, {
          name: trimmedName,
          color,
          icon,
          currentBalance: normalizedBalance,
        });
      } else {
        await createWallet({ name: trimmedName, color, icon, initialBalance: normalizedBalance });
      }
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!wallet) return;
    const confirmed = await confirmDestructive(
      "Usunąć portfel?",
      `Portfel „${wallet.name}” zostanie trwale usunięty wraz ze wszystkimi jego transakcjami.`,
      "Usuń portfel",
    );
    if (!confirmed) return;
    setIsSaving(true);
    try {
      await confirmWalletDelete(wallet);
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: wallet ? "Edytuj portfel" : "Nowy portfel" }} />
      <ScrollView contentContainerStyle={form.content} keyboardShouldPersistTaps="handled">
        <Text style={form.label}>Nazwa portfela</Text>
        <TextInput
          style={form.input}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!wallet}
          editable={!isSaving}
        />

        <Text style={form.label}>Kolor</Text>
        <ColorPicker value={color} onChange={setColor} disabled={isSaving} />

        <Text style={form.label}>Ikona (opcjonalnie)</Text>
        <IconPicker
          value={icon}
          onChange={setIcon}
          suggestions={WALLET_ICON_SUGGESTIONS}
          noneLabel="Bez ikony"
          fallback="wallet"
          disabled={isSaving}
        />

        <Text style={form.label}>{wallet ? "Stan aktualny" : "Stan początkowy"}</Text>
        <TextInput
          style={form.input}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
          placeholder="0.00"
          editable={!isSaving}
        />
        {wallet && (
          <Text style={form.hint}>Zmiana stanu zapisze transakcję „Korekta stanu”.</Text>
        )}

        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label={wallet ? "Zapisz zmiany" : "Utwórz portfel"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {wallet && (
          <View style={form.actions}>
            <Button
              label="Usuń portfel"
              variant="danger"
              disabled={isSaving}
              onPress={() => void remove()}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
