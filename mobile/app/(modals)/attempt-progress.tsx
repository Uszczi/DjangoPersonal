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
import { useBibliographyItem } from "@personal/shared/queries/bibliographyItems";

import { Button } from "@/ui/Button";
import { common, form } from "@/ui/classes";

/**
 * Move on the Attempt in progress (`?itemId=&attemptId=`): the page reached in
 * a book, the minute in a film. An empty field clears it; reaching the length
 * does not finish it.
 */
export default function AttemptProgressScreen() {
  const params = useLocalSearchParams<{ itemId: string; attemptId: string }>();
  const itemId = Number(params.itemId);
  const attemptId = Number(params.attemptId);
  const { data: item } = useBibliographyItem(itemId);
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
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono podejścia.</Text>
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
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>{ITEM_PROGRESS_LABELS[item.kind]}</Text>
        <TextInput
          className={form.input}
          value={progress}
          onChangeText={setProgress}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          editable={!isSaving}
        />
        {length !== null && <Text className={form.hint}>z {length}</Text>}
        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
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
