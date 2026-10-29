import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { attemptDatesError } from "@personal/shared/bibliographyForms";
import {
  useAttempts,
  useCreateAttempt,
  useUpdateAttempt,
} from "@personal/shared/queries/bibliographyAttempts";
import { dateFromKey, dateKey, todayKey } from "@personal/shared/timeFormat";

import { Button } from "../src/Button";
import { DateTimeField } from "../src/DateTimeField";
import { OptionalDateField } from "../src/OptionalDateField";
import { useTheme } from "../src/theme";

/**
 * What the screen does: start a new Attempt, record one that already ended,
 * finish or abandon the one in progress, or re-date an existing one.
 */
type AttemptAction = "start" | "record" | "finish" | "abandon" | "edit";

const ACTIONS: readonly AttemptAction[] = [
  "start",
  "record",
  "finish",
  "abandon",
  "edit",
];

const TITLES: Record<AttemptAction, string> = {
  start: "Zacznij podejście",
  record: "Dodaj ukończone podejście",
  finish: "Zakończ podejście",
  abandon: "Porzuć podejście",
  edit: "Edytuj podejście",
};

const SUBMIT_LABELS: Record<AttemptAction, string> = {
  start: "Zacznij",
  record: "Zapisz",
  finish: "Zakończ",
  abandon: "Porzuć",
  edit: "Zapisz",
};

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
  const action = ACTIONS.find((candidate) => candidate === params.action);
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

  const [startedOn, setStartedOn] = useState<Date | null>(() =>
    action === "start" ? today() : (attempt?.startedOn ?? null),
  );
  const [endedOn, setEndedOn] = useState<Date | null>(() =>
    action === "edit" ? (attempt?.endedOn ?? null) : today(),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const needsAttempt =
    action === "finish" || action === "abandon" || action === "edit";
  if (!action || (needsAttempt && !attempt)) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono podejścia.</Text>
      </View>
    );
  }

  const showsStart =
    action === "start" || action === "record" || action === "edit";
  const showsEnd =
    action === "record" ||
    action === "finish" ||
    action === "abandon" ||
    (action === "edit" && attempt?.outcome !== "in_progress");

  async function save() {
    switch (action) {
      case "start":
        return createAttempt.mutateAsync({
          item: itemId,
          outcome: "in_progress",
          startedOn,
          endedOn: null,
        });
      case "record":
        return createAttempt.mutateAsync({
          item: itemId,
          outcome: "finished",
          startedOn,
          endedOn,
        });
    }
    if (!attempt) throw new Error("No Attempt to change.");
    switch (action) {
      case "finish":
      case "abandon":
        return updateAttempt.mutateAsync({
          id: attempt.id,
          changes: {
            outcome: action === "finish" ? "finished" : "abandoned",
            endedOn,
          },
        });
      case "edit":
        return updateAttempt.mutateAsync({
          id: attempt.id,
          changes: showsEnd ? { startedOn, endedOn } : { startedOn },
        });
    }
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

  return (
    <View style={common.screen}>
      <Stack.Screen options={{ title: TITLES[action] }} />
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
            label={SUBMIT_LABELS[action]}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </View>
  );
}
