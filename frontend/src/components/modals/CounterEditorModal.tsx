import { useState, type FormEvent } from "react";

import { ColorPicker } from "@/components/ColorPicker";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { DEFAULT_COUNTER_COLOR } from "@personal/shared/colors";
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
  useUpdateCounter,
} from "@personal/shared/queries/counters";

type CounterEditorModalProps = {
  /** Omit to create a new counter; pass one to edit its name and colour. */
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
  const updateCounter = useUpdateCounter();

  const [name, setName] = useState(counter?.name ?? "");
  const [color, setColor] = useState<string>(
    counter?.color ?? DEFAULT_COUNTER_COLOR,
  );
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
        ? await updateCounter.mutateAsync({
            id: counter.id,
            name: trimmed,
            color,
          })
        : await createCounter.mutateAsync({ name: trimmed, color });
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
      kicker={counter ? "EDYCJA" : "NOWY LICZNIK"}
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
        <ColorPicker name="counter-color" value={color} onChange={setColor} />
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
