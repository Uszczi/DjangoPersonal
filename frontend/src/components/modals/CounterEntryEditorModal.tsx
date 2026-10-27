import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { DeleteCounterEntryModal } from "@/components/modals/DeleteCounterEntryModal";
import {
  Button,
  DateTimePicker,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextArea,
  TextInput,
} from "@/design-system";
import type { CounterEntryResponse } from "@personal/shared/generated/api";
import { useSaveCounterEntry } from "@personal/shared/queries/counters";
import { ShowModal } from "@/stores/modal";

type CounterEntryEditorModalProps = {
  counterId: number;
  /** Omit to add a new entry; pass one to edit it. */
  entry?: CounterEntryResponse | null;
  onClose: () => void;
};

function validateValue(raw: string): string {
  if (!raw) return "Podaj wartość.";
  if (!/^-?\d+$/.test(raw)) return "Wartość musi być liczbą całkowitą.";
  if (Number(raw) === 0) return "Wartość nie może być zerem.";
  return "";
}

export function CounterEntryEditorModal({
  counterId,
  entry = null,
  onClose,
}: CounterEntryEditorModalProps) {
  const saveEntry = useSaveCounterEntry();

  // A new entry defaults to the moment the modal opened.
  const [form, setForm] = useState(() => ({
    value: String(entry?.value ?? 1),
    occurredAt: entry?.occurredAt ?? (new Date() as Date | null),
    note: entry?.note ?? "",
  }));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = form.value.trim();
    const valueError = validateValue(value);
    if (valueError) {
      setFormError(valueError);
      return;
    }
    if (!form.occurredAt) {
      setFormError("Podaj datę i godzinę.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      await saveEntry.mutateAsync({
        counterId,
        input: {
          value: Number(value),
          occurredAt: form.occurredAt,
          note: form.note.trim(),
        },
        entry,
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
      kicker={entry ? "ZMIANA WPISU" : "NOWY WPIS"}
      title={entry ? "Edytuj wpis" : "Nowy wpis"}
      titleId="counter-entry-dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Wartość"
          hint="Liczba całkowita; ujemna odejmuje od sumy."
        >
          <TextInput
            inputMode="numeric"
            autoComplete="off"
            value={form.value}
            onChange={(event) =>
              setForm((current) => ({ ...current, value: event.target.value }))
            }
            required
          />
        </Field>
        <Field label="Kiedy">
          <DateTimePicker
            value={form.occurredAt}
            onChange={(occurredAt) =>
              setForm((current) => ({ ...current, occurredAt }))
            }
            required
          />
        </Field>
        <Field label="Notatka">
          <TextArea
            rows={3}
            maxLength={1000}
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
          />
        </Field>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          {entry && (
            <Button
              variant="ghostDanger"
              className="mr-auto"
              onClick={() => {
                onClose();
                ShowModal(DeleteCounterEntryModal, { entry });
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
            {isSaving ? "Zapisywanie…" : entry ? "Zapisz zmiany" : "Dodaj wpis"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
