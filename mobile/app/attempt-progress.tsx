import { router, useLocalSearchParams } from "expo-router";
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
import { ITEM_PROGRESS_LABELS } from "@personal/shared/bibliographyFormat";
import { parseProgress } from "@personal/shared/bibliographyForms";
import {
  useAttempts,
  useUpdateAttempt,
} from "@personal/shared/queries/bibliographyAttempts";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";

import { Button } from "../src/Button";
import { useTheme } from "../src/theme";

/**
 * Move on the Attempt in progress (`?itemId=&attemptId=`): the page reached in
 * a book, the minute in a film. An empty field clears it; reaching the length
 * does not finish it.
 */
export default function AttemptProgressScreen() {
  const { common, form } = useTheme();
  const params = useLocalSearchParams<{ itemId: string; attemptId: string }>();
  const itemId = Number(params.itemId);
  const attemptId = Number(params.attemptId);
  const { data: items = [] } = useBibliographyItems();
  const item = items.find((candidate) => candidate.id === itemId);
  const { data: attempts = [] } = useAttempts(itemId);
  const attempt = attempts.find((candidate) => candidate.id === attemptId);
  const updateAttempt = useUpdateAttempt();

  const [progress, setProgress] = useState(
    attempt?.progress == null ? "" : String(attempt.progress),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!item || !attempt) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono podejścia.</Text>
      </View>
    );
  }
  const { length } = item;

  async function submit() {
    if (!attempt) return;
    const parsed = parseProgress(progress, length);
    if ("error" in parsed) {
      setFormError(parsed.error);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await updateAttempt.mutateAsync({
        id: attempt.id,
        changes: { progress: parsed.value },
      });
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
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>{ITEM_PROGRESS_LABELS[item.kind]}</Text>
        <TextInput
          style={form.input}
          value={progress}
          onChangeText={setProgress}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          editable={!isSaving}
        />
        {length !== null && <Text style={form.hint}>z {length}</Text>}
        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label="Zapisz"
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
