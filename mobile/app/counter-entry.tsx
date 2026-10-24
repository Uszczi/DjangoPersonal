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
import { useCountersStore } from "@personal/shared/stores/counters";

import { Button } from "../src/Button";
import { DateTimeField } from "../src/DateTimeField";
import { common, form } from "../src/theme";

function validateValue(raw: string): string {
  if (!raw) return "Podaj wartość.";
  if (!/^-?\d+$/.test(raw)) return "Wartość musi być liczbą całkowitą.";
  if (Number(raw) === 0) return "Wartość nie może być zerem.";
  return "";
}

/** Adds a Counter entry (`?counterId=`) or edits one (`&entryId=`). */
export default function CounterEntryEditorScreen() {
  const params = useLocalSearchParams<{ counterId: string; entryId?: string }>();
  const counterId = Number(params.counterId);
  const entryId = params.entryId ? Number(params.entryId) : null;
  const entry = useCountersStore((state) =>
    entryId === null || state.entryList?.counterId !== counterId
      ? null
      : (state.entryList.entries.find((item) => item.id === entryId) ?? null),
  );
  const saveEntry = useCountersStore((state) => state.saveEntry);
  const deleteEntry = useCountersStore((state) => state.deleteEntry);

  // A new entry defaults to the moment the screen opened.
  const [value, setValue] = useState(String(entry?.value ?? 1));
  const [occurredAt, setOccurredAt] = useState(() => entry?.occurredAt ?? new Date());
  const [note, setNote] = useState(entry?.note ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (entryId !== null && !entry) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono wpisu.</Text>
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
      await saveEntry(
        counterId,
        { value: Number(trimmed), occurredAt, note: note.trim() },
        entry,
      );
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
            await deleteEntry(entry);
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
    setValue((current) => (current.startsWith("-") ? current.slice(1) : `-${current}`));
  }

  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: entry ? "Edytuj wpis" : "Nowy wpis" }} />
      <ScrollView contentContainerStyle={form.content} keyboardShouldPersistTaps="handled">
        <Text style={form.label}>Wartość</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button
            label="±"
            variant="secondary"
            accessibilityLabel="Zmień znak"
            disabled={isSaving}
            onPress={toggleSign}
            style={{ flex: 0, minWidth: 56 }}
          />
          <TextInput
            style={[form.input, { flex: 1 }]}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            editable={!isSaving}
            selectTextOnFocus
          />
        </View>
        <Text style={form.hint}>Liczba całkowita; ujemna odejmuje od sumy.</Text>

        <Text style={form.label}>Kiedy</Text>
        <DateTimeField value={occurredAt} onChange={setOccurredAt} disabled={isSaving} />

        <Text style={form.label}>Notatka</Text>
        <TextInput
          style={[form.input, form.multiline]}
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          editable={!isSaving}
        />

        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
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
          <View style={form.actions}>
            <Button label="Usuń wpis" variant="danger" disabled={isSaving} onPress={confirmDelete} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
