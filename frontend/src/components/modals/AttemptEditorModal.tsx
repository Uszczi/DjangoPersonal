import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";
import type { AttemptResponse } from "@personal/shared/generated/api";
import {
  useCreateAttempt,
  useUpdateAttempt,
} from "@personal/shared/queries/bibliographyAttempts";
import { dateFromKey, dateKey, todayKey } from "@personal/shared/timeFormat";

/**
 * What the dialog does: start a new Attempt, record one that already ended,
 * finish or abandon the one in progress, or re-date an existing one.
 */
export type AttemptAction = "start" | "record" | "finish" | "abandon" | "edit";

type AttemptEditorModalProps = {
  itemId: number;
  action: AttemptAction;
  /** The Attempt to finish, abandon or edit; omit for `start` and `record`. */
  attempt?: AttemptResponse | null;
  onClose: () => void;
};

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

function keyOf(date: Date | null | undefined) {
  return date ? dateKey(date) : "";
}

export function AttemptEditorModal({
  itemId,
  action,
  attempt = null,
  onClose,
}: AttemptEditorModalProps) {
  const createAttempt = useCreateAttempt();
  const updateAttempt = useUpdateAttempt();

  const showsStart =
    action === "start" || action === "record" || action === "edit";
  const showsEnd =
    action === "record" ||
    action === "finish" ||
    action === "abandon" ||
    (action === "edit" && attempt?.outcome !== "in_progress");

  const [startedOn, setStartedOn] = useState(
    action === "start" ? todayKey() : keyOf(attempt?.startedOn),
  );
  const [endedOn, setEndedOn] = useState(
    action === "edit" ? keyOf(attempt?.endedOn) : todayKey(),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function save() {
    const start = startedOn ? dateFromKey(startedOn) : null;
    const end = dateFromKey(endedOn);
    switch (action) {
      case "start":
        return createAttempt.mutateAsync({
          item: itemId,
          outcome: "in_progress",
          startedOn: start,
          endedOn: null,
        });
      case "record":
        return createAttempt.mutateAsync({
          item: itemId,
          outcome: "finished",
          startedOn: start,
          endedOn: end,
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
            endedOn: end,
          },
        });
      case "edit":
        return updateAttempt.mutateAsync({
          id: attempt.id,
          changes: showsEnd
            ? { startedOn: start, endedOn: end }
            : { startedOn: start },
        });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (showsEnd && !endedOn) {
      setFormError("Podaj datę zakończenia.");
      return;
    }
    if (showsEnd && startedOn && endedOn < startedOn) {
      setFormError(
        "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.",
      );
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      await save();
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      kicker="PODEJŚCIE"
      title={TITLES[action]}
      titleId="attempt-dialog-title"
      onClose={close}
    >
      <form onSubmit={handleSubmit} noValidate>
        {showsStart && (
          <Field label="Data rozpoczęcia" hint="Opcjonalna.">
            <TextInput
              type="date"
              value={startedOn}
              onChange={(event) => setStartedOn(event.target.value)}
            />
          </Field>
        )}
        {showsEnd && (
          <Field label="Data zakończenia">
            <TextInput
              type="date"
              value={endedOn}
              onChange={(event) => setEndedOn(event.target.value)}
              required
            />
          </Field>
        )}
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Zapisywanie…" : SUBMIT_LABELS[action]}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
