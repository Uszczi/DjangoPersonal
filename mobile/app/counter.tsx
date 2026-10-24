import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useCountersStore } from "@personal/shared/stores/counters";

import { Button } from "../src/Button";
import { common, form } from "../src/theme";

/** Creates a Counter, or renames one (`?counterId=`). */
export default function CounterEditorScreen() {
  const params = useLocalSearchParams<{ counterId?: string }>();
  const counterId = params.counterId ? Number(params.counterId) : null;
  const counter = useCountersStore((state) =>
    counterId === null ? null : (state.counters.find((item) => item.id === counterId) ?? null),
  );
  const createCounter = useCountersStore((state) => state.createCounter);
  const renameCounter = useCountersStore((state) => state.renameCounter);

  const [name, setName] = useState(counter?.name ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Podaj nazwę licznika.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (counter) {
        await renameCounter(counter.id, trimmed);
        router.back();
      } else {
        // Like the web: a new Counter opens straight away.
        const created = await createCounter(trimmed);
        router.replace({ pathname: "/counters/[id]", params: { id: created.id } });
      }
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
      <Stack.Screen options={{ title: counter ? "Edytuj licznik" : "Nowy licznik" }} />
      <ScrollView contentContainerStyle={form.content} keyboardShouldPersistTaps="handled">
        <Text style={form.label}>Nazwa licznika</Text>
        <TextInput
          style={form.input}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
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
            label={counter ? "Zapisz zmiany" : "Utwórz licznik"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
