import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  ITEM_PROGRESS_LABELS,
  type ItemKind,
} from "@personal/shared/bibliographyFormat";
import { parseProgress } from "@personal/shared/bibliographyForms";
import type { AttemptResponse } from "@personal/shared/generated/api";
import { useUpdateAttempt } from "@personal/shared/queries/bibliographyAttempts";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";

type AttemptProgressModalProps = {
  /** The Attempt in progress. */
  attempt: AttemptResponse;
  kind: ItemKind;
  /** The item's length (pages or minutes), the upper bound when known. */
  length: number | null;
  onClose: () => void;
};

/**
 * Move on the Attempt in progress: the page reached in a book, the minute in a
 * film. An empty field clears it; reaching the length does not finish it.
 */
export function AttemptProgressModal({
  attempt,
  kind,
  length,
  onClose,
}: AttemptProgressModalProps) {
  const updateAttempt = useUpdateAttempt();
  const [progress, setProgress] = useState(
    attempt.progress === null ? "" : String(attempt.progress),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      title="Postęp"
      titleId="attempt-progress-dialog-title"
      onClose={close}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field
          label={ITEM_PROGRESS_LABELS[kind]}
          hint={length === null ? undefined : `z ${length}`}
        >
          <TextInput
            type="number"
            min={0}
            max={length ?? undefined}
            step={1}
            inputMode="numeric"
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
            autoFocus
          />
        </Field>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
