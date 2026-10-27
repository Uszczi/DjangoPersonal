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
import type { CounterResponse } from "@personal/shared/generated/api";
import {
  useCreateCounter,
  useRenameCounter,
} from "@personal/shared/queries/counters";

type CounterEditorModalProps = {
  /** Omit to create a new counter; pass one to rename it. */
  counter?: CounterResponse | null;
  /** Called with the saved counter, e.g. to open a newly created one. */
  onSaved?: (counter: CounterResponse) => void;
  onClose: () => void;
};

export function CounterEditorModal({
  counter = null,
  onSaved,
  onClose,
}: CounterEditorModalProps) {
  const createCounter = useCreateCounter();
  const renameCounter = useRenameCounter();

  const [name, setName] = useState(counter?.name ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Podaj nazwę licznika.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      const saved = counter
        ? await renameCounter.mutateAsync({ id: counter.id, name: trimmed })
        : await createCounter.mutateAsync(trimmed);
      onClose();
      onSaved?.(saved);
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      kicker={counter ? "ZMIANA NAZWY" : "NOWY LICZNIK"}
      title={counter ? "Edytuj licznik" : "Nowy licznik"}
      titleId="counter-dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nazwa licznika">
          <TextInput
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving
              ? "Zapisywanie…"
              : counter
                ? "Zapisz zmiany"
                : "Utwórz licznik"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
