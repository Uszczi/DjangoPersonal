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
import { useCategories } from "@personal/shared/queries/categories";
import {
  useDeleteTransaction,
  useSaveTransaction,
  useWalletTransactions,
  type TransactionInput,
} from "@personal/shared/queries/transactions";
import { useWallets } from "@personal/shared/queries/wallets";
import { dateFromKey, dateKey, todayKey } from "@personal/shared/timeFormat";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { confirmDestructive } from "@/ui/confirm";
import { DateTimeField } from "@/ui/DateTimeField";
import { common, form } from "@/ui/classes";

/** `0` stands for "no category" in the chip group, which needs a non-null value. */
const NO_CATEGORY = 0;

function validateAmount(raw: string): string {
  if (!raw) return "Podaj kwotę.";
  const value = Number(raw);
  if (Number.isNaN(value) || value <= 0)
    return "Kwota musi być większa od zera.";
  const fraction = raw.split(".")[1];
  if (fraction && fraction.length > 2)
    return "Kwota może mieć maksymalnie 2 miejsca dziesiętne.";
  return "";
}

/**
 * Adds a Transaction to `?walletId=`, or edits one (`&transactionId=`) of
 * that Wallet's loaded pages, like the web TransactionEditorModal.
 */
export default function TransactionEditorScreen() {
  const params = useLocalSearchParams<{
    walletId: string;
    transactionId?: string;
  }>();
  const walletId = Number(params.walletId);
  const transactionId = params.transactionId
    ? Number(params.transactionId)
    : null;

  const { data: loaded = [] } = useWalletTransactions(
    transactionId === null ? null : walletId,
  );
  const saveTransaction = useSaveTransaction();
  const deleteTransaction = useDeleteTransaction();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const transaction =
    transactionId === null
      ? null
      : (loaded.find((item) => item.id === transactionId) ?? null);

  const [title, setTitle] = useState(transaction?.title ?? "");
  const [amount, setAmount] = useState(transaction?.amount ?? "");
  const [date, setDate] = useState(
    transaction ? dateKey(transaction.date) : todayKey(),
  );
  const [description, setDescription] = useState(
    transaction?.description ?? "",
  );
  const [category, setCategory] = useState<number>(
    transaction?.categoryId ?? NO_CATEGORY,
  );
  const [wallet, setWallet] = useState<number>(
    transaction?.walletId ?? walletId,
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (transactionId !== null && !transaction) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono transakcji.</Text>
      </View>
    );
  }

  // A System entry (kind null) is read-only: its signed amount is the ledger.
  const isSystemEntry = transaction?.kind === null;
  // The direction the chosen category carries (no category is an Expense).
  const selectedCategory = categories.find((item) => item.id === category);
  const kind = selectedCategory?.kind ?? "expense";

  const screenTitle = isSystemEntry
    ? "Wpis systemowy"
    : transaction
      ? kind === "income"
        ? "Edytuj przychód"
        : "Edytuj wydatek"
      : kind === "income"
        ? "Nowy przychód"
        : "Nowy wydatek";
  const saveLabel = transaction
    ? "Zapisz zmiany"
    : kind === "income"
      ? "Dodaj przychód"
      : "Dodaj wydatek";

  // The System category (balance corrections) is never offered for a new pick.
  const expenseCategories = categories.filter(
    (item) => !item.isSystem && item.kind === "expense",
  );
  const incomeCategories = categories.filter(
    (item) => !item.isSystem && item.kind === "income",
  );

  async function submit() {
    const input: TransactionInput = {
      title: title.trim(),
      // Accept a decimal comma from the phone keyboard.
      amount: amount.trim().replace(",", "."),
      date,
      description: description.trim(),
      category: category === NO_CATEGORY ? null : category,
      wallet,
    };
    if (!input.title) {
      setFormError("Podaj tytuł.");
      return;
    }
    const amountError = validateAmount(input.amount);
    if (amountError) {
      setFormError(amountError);
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      // The mutation also refreshes the balances it changed.
      await saveTransaction.mutateAsync({ input, transaction });
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!transaction) return;
    const confirmed = await confirmDestructive(
      "Usunąć transakcję?",
      `Transakcja „${transaction.title}” zostanie trwale usunięta.`,
      "Usuń transakcję",
    );
    if (!confirmed) return;
    setIsSaving(true);
    try {
      await deleteTransaction.mutateAsync(transaction);
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  const fieldsDisabled = isSaving || isSystemEntry;

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: screenTitle }} />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        {isSystemEntry && (
          <Text className="mt-1 rounded bg-wash px-3 py-2.5 text-[13px] leading-[18px] text-ink-soft">
            Ten wpis zapisał system (stan początkowy lub korekta stanu). Nie
            można go edytować, tylko usunąć. Saldo poprawisz w ustawieniach
            portfela.
          </Text>
        )}

        <Text className={form.label}>Tytuł</Text>
        <TextInput
          className={form.input}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          autoFocus={!transaction}
          editable={!fieldsDisabled}
        />

        <Text className={form.label}>Kwota</Text>
        <TextInput
          className={form.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={!fieldsDisabled}
        />

        <Text className={form.label}>Data</Text>
        <DateTimeField
          mode="date"
          value={dateFromKey(date)}
          onChange={(value) => setDate(dateKey(value))}
          disabled={fieldsDisabled}
        />

        <Text className={form.label}>Opis</Text>
        <TextInput
          className={form.multiline}
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!fieldsDisabled}
        />

        <Text className={form.label}>Kategoria</Text>
        {isSystemEntry ? (
          <ChipGroup
            options={[{ value: category, label: "System" }]}
            value={category}
            onChange={setCategory}
            disabled
          />
        ) : (
          <>
            <Text className="mt-3 text-xs font-semibold tracking-[0.6px] text-muted uppercase">
              Wydatki
            </Text>
            <ChipGroup
              options={[
                { value: NO_CATEGORY, label: "Bez kategorii" },
                ...expenseCategories.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              value={category}
              onChange={setCategory}
              disabled={isSaving}
            />
            <Text className="mt-3 text-xs font-semibold tracking-[0.6px] text-muted uppercase">
              Przychody
            </Text>
            <ChipGroup
              options={incomeCategories.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={category}
              onChange={setCategory}
              disabled={isSaving}
            />
          </>
        )}

        {wallets.length > 1 && (
          <>
            <Text className={form.label}>Portfel</Text>
            <ChipGroup
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={wallet}
              onChange={setWallet}
              disabled={fieldsDisabled}
            />
          </>
        )}

        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        {isSystemEntry ? (
          <View className={form.actions}>
            <Button
              label="Usuń transakcję"
              variant="danger"
              disabled={isSaving}
              onPress={() => void remove()}
            />
          </View>
        ) : (
          <View className={form.actions}>
            <Button
              label="Anuluj"
              variant="secondary"
              disabled={isSaving}
              onPress={() => router.back()}
            />
            <Button
              label={saveLabel}
              isBusy={isSaving}
              onPress={() => void submit()}
            />
          </View>
        )}
        {transaction && !isSystemEntry && (
          <View className={form.actions}>
            <Button
              label="Usuń transakcję"
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
