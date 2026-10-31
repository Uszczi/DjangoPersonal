import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  ATTEMPT_ACTIONS,
  ATTEMPT_SUBMIT_LABELS,
  ATTEMPT_TITLES,
  actionNeedsAttempt,
  attemptDatesError,
  attemptFormFields,
  attemptWrite,
} from "@personal/shared/bibliographyForms";
import {
  useAttempts,
  useCreateAttempt,
  useDeleteAttempt,
  useUpdateAttempt,
} from "@personal/shared/queries/bibliographyAttempts";
import { dateFromKey, dateKey, todayKey } from "@personal/shared/timeFormat";

import { Button } from "../src/ui/Button";
import { DateTimeField } from "../src/ui/DateTimeField";
import { OptionalDateField } from "../src/ui/OptionalDateField";
import { useTheme } from "../src/theme";

function today() {
  return dateFromKey(todayKey());
}

/** An Attempt of `?itemId=`: `&action=` says what to do, `&attemptId=` which one to change. */
export default function AttemptEditorScreen() {
  const { common, form } = useTheme();
  const params = useLocalSearchParams<{
    itemId: string;
    action: string;
    attemptId?: string;
  }>();
  const itemId = Number(params.itemId);
  const action = ATTEMPT_ACTIONS.find(
    (candidate) => candidate === params.action,
  );
  const attemptId = params.attemptId ? Number(params.attemptId) : null;
  const { data: attempts = [] } = useAttempts(
    attemptId === null ? null : itemId,
  );
  const attempt =
    attemptId === null
      ? null
      : (attempts.find((candidate) => candidate.id === attemptId) ?? null);
  const createAttempt = useCreateAttempt();
  const updateAttempt = useUpdateAttempt();
  const deleteAttempt = useDeleteAttempt();

  const [startedOn, setStartedOn] = useState<Date | null>(() =>
    action === "start" ? today() : (attempt?.startedOn ?? null),
  );
  const [endedOn, setEndedOn] = useState<Date | null>(() =>
    action === "edit" ? (attempt?.endedOn ?? null) : today(),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!action || (actionNeedsAttempt(action) && !attempt)) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono podejścia.</Text>
      </View>
    );
  }

  const { showsStart, showsEnd } = attemptFormFields(action, attempt);

  async function save() {
    if (!action) return;
    const write = attemptWrite(action, { itemId, attempt, startedOn, endedOn });
    return "create" in write
      ? createAttempt.mutateAsync(write.create)
      : updateAttempt.mutateAsync(write.update);
  }

  async function submit() {
    const datesError = showsEnd
      ? attemptDatesError({
          startedOn: startedOn ? dateKey(startedOn) : "",
          endedOn: endedOn ? dateKey(endedOn) : "",
        })
      : "";
    if (datesError) {
      setFormError(datesError);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await save();
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!attempt) return;
    Alert.alert("Usunąć podejście?", undefined, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń podejście",
        style: "destructive",
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteAttempt.mutateAsync({ id: attempt.id, itemId });
            router.back();
          } catch (error) {
            setFormError(await apiErrorMessage(error));
            setIsSaving(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={common.screen}>
      <Stack.Screen options={{ title: ATTEMPT_TITLES[action] }} />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        {showsStart && (
          <>
            <Text style={form.label}>Data rozpoczęcia</Text>
            <OptionalDateField
              value={startedOn}
              onChange={setStartedOn}
              disabled={isSaving}
            />
            <Text style={form.hint}>Opcjonalna.</Text>
          </>
        )}
        {showsEnd && (
          <>
            <Text style={form.label}>Data zakończenia</Text>
            <DateTimeField
              mode="date"
              value={endedOn ?? today()}
              onChange={setEndedOn}
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
            label={ATTEMPT_SUBMIT_LABELS[action]}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {action === "edit" && (
          <View style={form.actions}>
            <Button
              label="Usuń podejście"
              variant="danger"
              disabled={isSaving}
              onPress={confirmDelete}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
