import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  Select,
  TextArea,
  TextInput,
} from "@/design-system";
import type { PozycjaResponse } from "@personal/shared/generated/api";
import {
  POZYCJA_KIND_LABELS,
  POZYCJA_LENGTH_LABELS,
  type PozycjaKind,
} from "@personal/shared/pozycjaFormat";
import {
  useCreatePozycja,
  useUpdatePozycja,
} from "@personal/shared/queries/pozycje";

type PozycjaEditorModalProps = {
  /** Omit to add a new Pozycja; pass one to edit it. */
  pozycja?: PozycjaResponse | null;
  onClose: () => void;
};

const KINDS: PozycjaKind[] = ["film", "book"];

const CREATOR_LABELS: Record<PozycjaKind, string> = {
  film: "Reżyser",
  book: "Autor",
};

/** `""` → `null`; a positive whole number → that number; anything else → `undefined` (invalid). */
function optionalPositiveInt(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 ? value : undefined;
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function PozycjaEditorModal({
  pozycja = null,
  onClose,
}: PozycjaEditorModalProps) {
  const createPozycja = useCreatePozycja();
  const updatePozycja = useUpdatePozycja();

  const [kind, setKind] = useState<PozycjaKind>(pozycja?.kind ?? "film");
  const [title, setTitle] = useState(pozycja?.title ?? "");
  const [creator, setCreator] = useState(pozycja?.creator ?? "");
  const [year, setYear] = useState(numberText(pozycja?.year));
  const [length, setLength] = useState(numberText(pozycja?.length));
  const [note, setNote] = useState(pozycja?.note ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Podaj tytuł.");
      return;
    }
    const yearValue = optionalPositiveInt(year);
    const lengthValue = optionalPositiveInt(length);
    if (yearValue === undefined || lengthValue === undefined) {
      setFormError("Rok i długość muszą być dodatnimi liczbami całkowitymi.");
      return;
    }
    const fields = {
      title: trimmedTitle,
      creator: creator.trim(),
      year: yearValue,
      length: lengthValue,
      note: note.trim(),
    };

    setIsSaving(true);
    setFormError("");
    try {
      if (pozycja) {
        await updatePozycja.mutateAsync({ id: pozycja.id, changes: fields });
      } else {
        await createPozycja.mutateAsync({ kind, ...fields });
      }
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      kicker={pozycja ? "EDYCJA POZYCJI" : "NOWA POZYCJA"}
      title={pozycja ? "Edytuj pozycję" : "Nowa pozycja"}
      titleId="pozycja-dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Rodzaj"
          hint={pozycja ? "Rodzaju nie można zmienić." : undefined}
        >
          <Select
            value={kind}
            disabled={pozycja !== null}
            onChange={(event) => setKind(event.target.value as PozycjaKind)}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {POZYCJA_KIND_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tytuł">
          <TextInput
            maxLength={300}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
        <Field label={CREATOR_LABELS[kind]}>
          <TextInput
            maxLength={200}
            value={creator}
            onChange={(event) => setCreator(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Rok">
            <TextInput
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </Field>
          <Field label={POZYCJA_LENGTH_LABELS[kind]}>
            <TextInput
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={length}
              onChange={(event) => setLength(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Notatka">
          <TextArea
            rows={3}
            maxLength={10000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
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
              : pozycja
                ? "Zapisz zmiany"
                : "Dodaj pozycję"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
