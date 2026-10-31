import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { balanceError } from "@personal/shared/money";
import {
  useCreateWallet,
  useDeleteWallet,
  useUpdateWallet,
  useWallets,
} from "@personal/shared/queries/wallets";
import { DEFAULT_WALLET_COLOR } from "@personal/shared/colors";
import { WALLET_ICON_SUGGESTIONS } from "@personal/shared/walletIcons";

import { Button } from "../../src/ui/Button";
import { ColorPicker } from "../../src/ui/ColorPicker";
import { confirmDestructive } from "../../src/ui/confirm";
import { IconPicker } from "../../src/ui/IconPicker";
import { common, form } from "../../src/ui/classes";

/**
 * Creates a Wallet (with an opening balance), or edits one (`?walletId=`):
 * name, colour, icon and the balance it now holds. A changed balance is
 * recorded by the server as a System correction.
 */
export default function WalletEditorScreen() {
  const params = useLocalSearchParams<{ walletId?: string }>();
  const walletId = params.walletId ? Number(params.walletId) : null;
  const { data: wallets = [] } = useWallets();
  const wallet =
    walletId === null
      ? null
      : (wallets.find((item) => item.id === walletId) ?? null);
  const createWallet = useCreateWallet();
  const updateWallet = useUpdateWallet();
  const deleteWallet = useDeleteWallet();

  const [name, setName] = useState(wallet?.name ?? "");
  const [color, setColor] = useState<string>(
    wallet?.color ?? DEFAULT_WALLET_COLOR,
  );
  const [icon, setIcon] = useState<string | null>(wallet?.icon ?? null);
  const [balance, setBalance] = useState(
    wallet ? (wallet.balance ?? "0.00") : "",
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (walletId !== null && !wallet) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono portfela.</Text>
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
        await updateWallet.mutateAsync({
          wallet,
          input: {
            name: trimmedName,
            color,
            icon,
            currentBalance: normalizedBalance,
          },
        });
      } else {
        await createWallet.mutateAsync({
          name: trimmedName,
          color,
          icon,
          initialBalance: normalizedBalance,
        });
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
      await deleteWallet.mutateAsync(wallet);
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: wallet ? "Edytuj portfel" : "Nowy portfel" }}
      />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Nazwa portfela</Text>
        <TextInput
          className={form.input}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!wallet}
          editable={!isSaving}
        />

        <Text className={form.label}>Kolor</Text>
        <ColorPicker value={color} onChange={setColor} disabled={isSaving} />

        <Text className={form.label}>Ikona (opcjonalnie)</Text>
        <IconPicker
          value={icon}
          onChange={setIcon}
          suggestions={WALLET_ICON_SUGGESTIONS}
          noneLabel="Bez ikony"
          fallback="wallet"
          disabled={isSaving}
        />

        <Text className={form.label}>
          {wallet ? "Stan aktualny" : "Stan początkowy"}
        </Text>
        <TextInput
          className={form.input}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
          placeholder="0.00"
          editable={!isSaving}
        />
        {wallet && (
          <Text className={form.hint}>
            Zmiana stanu zapisze transakcję „Korekta stanu”.
          </Text>
        )}

        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
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
          <View className={form.actions}>
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
