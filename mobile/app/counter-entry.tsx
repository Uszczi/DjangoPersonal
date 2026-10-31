import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  useCounterEntries,
  useDeleteCounterEntry,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";

import { Button } from "../src/ui/Button";
import { DateTimeField } from "../src/ui/DateTimeField";
import { common, form } from "../src/ui/classes";

function validateValue(raw: string): string {
  if (!raw) return "Podaj wartość.";
  if (!/^-?\d+$/.test(raw)) return "Wartość musi być liczbą całkowitą.";
  if (Number(raw) === 0) return "Wartość nie może być zerem.";
  return "";
}

/** Adds a Counter entry (`?counterId=`) or edits one (`&entryId=`). */
export default function CounterEntryEditorScreen() {
  const params = useLocalSearchParams<{
    counterId: string;
    entryId?: string;
  }>();
  const counterId = Number(params.counterId);
  const entryId = params.entryId ? Number(params.entryId) : null;
  const { data: entries = [] } = useCounterEntries(
    entryId === null ? null : counterId,
  );
  const entry =
    entryId === null
      ? null
      : (entries.find((item) => item.id === entryId) ?? null);
  const saveEntry = useSaveCounterEntry();
  const deleteEntry = useDeleteCounterEntry();

  // A new entry defaults to the moment the screen opened.
  const [value, setValue] = useState(String(entry?.value ?? 1));
  const [occurredAt, setOccurredAt] = useState(
    () => entry?.occurredAt ?? new Date(),
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (entryId !== null && !entry) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono wpisu.</Text>
      </View>
    );
  }

  async function submit() {
    const trimmed = value.trim();
    const valueError = validateValue(trimmed);
    if (valueError) {
      setFormError(valueError);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await saveEntry.mutateAsync({
        counterId,
        input: { value: Number(trimmed), occurredAt, note: note.trim() },
        entry,
      });
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!entry) return;
    Alert.alert("Usunąć wpis?", undefined, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń wpis",
        style: "destructive",
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteEntry.mutateAsync(entry);
            router.back();
          } catch (error) {
            setFormError(await apiErrorMessage(error));
            setIsSaving(false);
          }
        },
      },
    ]);
  }

  /** Flips the sign, since the number pad has no minus key on every phone. */
  function toggleSign() {
    setValue((current) =>
      current.startsWith("-") ? current.slice(1) : `-${current}`,
    );
  }

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: entry ? "Edytuj wpis" : "Nowy wpis" }} />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Wartość</Text>
        <View className="flex-row gap-3">
          <Button
            label="±"
            variant="secondary"
            accessibilityLabel="Zmień znak"
            disabled={isSaving}
            onPress={toggleSign}
            className="min-w-14 flex-none"
          />
          <TextInput
            className={`${form.input} flex-1`}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            editable={!isSaving}
            selectTextOnFocus
          />
        </View>
        <Text className={form.hint}>
          Liczba całkowita; ujemna odejmuje od sumy.
        </Text>

        <Text className={form.label}>Kiedy</Text>
        <DateTimeField
          value={occurredAt}
          onChange={setOccurredAt}
          disabled={isSaving}
        />

        <Text className={form.label}>Notatka</Text>
        <TextInput
          className={form.multiline}
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          editable={!isSaving}
        />

        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label={entry ? "Zapisz zmiany" : "Dodaj wpis"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {entry && (
          <View className={form.actions}>
            <Button
              label="Usuń wpis"
              variant="danger"
              disabled={isSaving}
              onPress={confirmDelete}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
