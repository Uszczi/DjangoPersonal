import { useState, type FormEvent } from "react";

import { DeleteAttemptModal } from "@/components/modals/DeleteAttemptModal";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  ATTEMPT_SUBMIT_LABELS,
  ATTEMPT_TITLES,
  attemptDatesError,
  attemptFormFields,
  attemptWrite,
  type AttemptAction,
} from "@personal/shared/bibliographyForms";
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
import { ShowModal } from "@/stores/modal";

type AttemptEditorModalProps = {
  itemId: number;
  action: AttemptAction;
  /** The Attempt to finish, abandon or edit; omit for `start` and `record`. */
  attempt?: AttemptResponse | null;
  onClose: () => void;
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

  const { showsStart, showsEnd } = attemptFormFields(action, attempt);

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
    const write = attemptWrite(action, {
      itemId,
      attempt,
      startedOn: startedOn ? dateFromKey(startedOn) : null,
      endedOn: dateFromKey(endedOn),
    });
    return "create" in write
      ? createAttempt.mutateAsync(write.create)
      : updateAttempt.mutateAsync(write.update);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datesError = showsEnd
      ? attemptDatesError({ startedOn, endedOn })
      : "";
    if (datesError) {
      setFormError(datesError);
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
      title={ATTEMPT_TITLES[action]}
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
          {action === "edit" && attempt && (
            <Button
              variant="ghostDanger"
              className="mr-auto"
              onClick={() => {
                onClose();
                ShowModal(DeleteAttemptModal, { attempt });
              }}
              disabled={isSaving}
            >
              Usuń
            </Button>
          )}
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Zapisywanie…" : ATTEMPT_SUBMIT_LABELS[action]}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
