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
import { DEFAULT_COUNTER_COLOR } from "@personal/shared/colors";
import {
  useCounters,
  useCreateCounter,
  useUpdateCounter,
} from "@personal/shared/queries/counters";

import { Button } from "@/ui/Button";
import { ColorPicker } from "@/ui/ColorPicker";
import { common, form } from "@/ui/classes";

/** Creates a Counter, or edits one (`?counterId=`): its name and colour. */
export default function CounterEditorScreen() {
  const params = useLocalSearchParams<{ counterId?: string }>();
  const counterId = params.counterId ? Number(params.counterId) : null;
  const { data: counters = [] } = useCounters();
  const counter =
    counterId === null
      ? null
      : (counters.find((item) => item.id === counterId) ?? null);
  const createCounter = useCreateCounter();
  const updateCounter = useUpdateCounter();

  const [name, setName] = useState(counter?.name ?? "");
  const [color, setColor] = useState<string>(
    counter?.color ?? DEFAULT_COUNTER_COLOR,
  );
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
        await updateCounter.mutateAsync({
          id: counter.id,
          name: trimmed,
          color,
        });
        router.back();
      } else {
        // Like the web: a new Counter opens straight away.
        const created = await createCounter.mutateAsync({
          name: trimmed,
          color,
        });
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
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: counter ? "Edytuj licznik" : "Nowy licznik" }}
      />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Nazwa licznika</Text>
        <TextInput
          className={form.input}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          editable={!isSaving}
        />

        <Text className={form.label}>Kolor</Text>
        <ColorPicker value={color} onChange={setColor} disabled={isSaving} />
        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
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
