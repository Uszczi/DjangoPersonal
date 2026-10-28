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
import {
  useCounters,
  useCreateCounter,
  useRenameCounter,
} from "@personal/shared/queries/counters";

import { Button } from "../src/Button";
import { useTheme } from "../src/theme";

/** Creates a Counter, or renames one (`?counterId=`). */
export default function CounterEditorScreen() {
  const { common, form } = useTheme();
  const params = useLocalSearchParams<{ counterId?: string }>();
  const counterId = params.counterId ? Number(params.counterId) : null;
  const { data: counters = [] } = useCounters();
  const counter =
    counterId === null
      ? null
      : (counters.find((item) => item.id === counterId) ?? null);
  const createCounter = useCreateCounter();
  const renameCounter = useRenameCounter();

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
        await renameCounter.mutateAsync({ id: counter.id, name: trimmed });
        router.back();
      } else {
        // Like the web: a new Counter opens straight away.
        const created = await createCounter.mutateAsync(trimmed);
        router.replace({
          pathname: "/counters/[id]",
          params: { id: created.id },
        });
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
      <Stack.Screen
        options={{ title: counter ? "Edytuj licznik" : "Nowy licznik" }}
      />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
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
