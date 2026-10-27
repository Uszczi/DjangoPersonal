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
import { useCategoriesStore } from "@personal/shared/stores/categories";
import {
  useTransactionsStore,
  type TransactionInput,
} from "@personal/shared/stores/transactions";
import { useWalletsStore } from "@personal/shared/stores/wallets";
import { dateFromKey, dateKey, todayKey } from "@personal/shared/timeFormat";

import { Button } from "../src/Button";
import { ChipGroup } from "../src/ChipGroup";
import { confirmDestructive } from "../src/confirm";
import { DateTimeField } from "../src/DateTimeField";
import { common, form } from "../src/theme";

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
 * Adds a Transaction to `?walletId=`, or edits one (`&transactionId=`), like
 * the web TransactionEditorModal.
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

  const transactionList = useTransactionsStore(
    (state) => state.transactionList,
  );
  const saveTransaction = useTransactionsStore(
    (state) => state.saveTransaction,
  );
  const confirmTransactionDelete = useTransactionsStore(
    (state) => state.confirmTransactionDelete,
  );
  const wallets = useWalletsStore((state) => state.wallets);
  const refreshWallets = useWalletsStore((state) => state.refreshWallets);
  const categories = useCategoriesStore((state) => state.categories);
  const transaction =
    transactionId === null
      ? null
      : (transactionList?.transactions.find(
          (item) => item.id === transactionId,
        ) ?? null);

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
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono transakcji.</Text>
      </View>
    );
  }

  // The System category (balance corrections) is never offered for a new pick.
  const categoryOptions = [
    { value: NO_CATEGORY, label: "Bez kategorii" },
    ...categories
      .filter((item) => !item.isSystem || item.id === transaction?.categoryId)
      .map((item) => ({ value: item.id, label: item.name })),
  ];

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
      await saveTransaction(input, transaction);
      // Balances are computed from the ledger: refresh the wallet the
      // transaction is in and, when it moved, the one it left.
      void refreshWallets(
        transaction ? [transaction.walletId, input.wallet] : [input.wallet],
      );
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
      await confirmTransactionDelete(transaction);
      void refreshWallets([transaction.walletId]);
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
      <Stack.Screen
        options={{
          title: transaction ? "Edytuj transakcję" : "Nowa transakcja",
        }}
      />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>Tytuł</Text>
        <TextInput
          style={form.input}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          autoFocus={!transaction}
          editable={!isSaving}
        />

        <Text style={form.label}>Kwota</Text>
        <TextInput
          style={form.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={!isSaving}
        />

        <Text style={form.label}>Data</Text>
        <DateTimeField
          mode="date"
          value={dateFromKey(date)}
          onChange={(value) => setDate(dateKey(value))}
          disabled={isSaving}
        />

        <Text style={form.label}>Opis</Text>
        <TextInput
          style={[form.input, form.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isSaving}
        />

        <Text style={form.label}>Kategoria</Text>
        <ChipGroup
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          disabled={isSaving}
        />

        {wallets.length > 1 && (
          <>
            <Text style={form.label}>Portfel</Text>
            <ChipGroup
              options={wallets.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={wallet}
              onChange={setWallet}
              disabled={isSaving}
            />
          </>
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
            label={transaction ? "Zapisz zmiany" : "Dodaj transakcję"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {transaction && (
          <View style={form.actions}>
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
