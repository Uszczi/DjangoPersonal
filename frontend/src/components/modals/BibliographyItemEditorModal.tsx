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
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import {
  ITEM_KIND_LABELS,
  ITEM_LENGTH_LABELS,
  type ItemKind,
} from "@personal/shared/bibliographyFormat";
import {
  useCreateBibliographyItem,
  useUpdateBibliographyItem,
} from "@personal/shared/queries/bibliographyItems";

type BibliographyItemEditorModalProps = {
  /** Omit to add a new BibliographyItem; pass one to edit it. */
  item?: BibliographyItemResponse | null;
  onClose: () => void;
};

const KINDS: ItemKind[] = ["film", "book"];

const CREATOR_LABELS: Record<ItemKind, string> = {
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

export function BibliographyItemEditorModal({
  item = null,
  onClose,
}: BibliographyItemEditorModalProps) {
  const createBibliographyItem = useCreateBibliographyItem();
  const updateBibliographyItem = useUpdateBibliographyItem();

  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "film");
  const [title, setTitle] = useState(item?.title ?? "");
  const [creator, setCreator] = useState(item?.creator ?? "");
  const [year, setYear] = useState(numberText(item?.year));
  const [length, setLength] = useState(numberText(item?.length));
  const [note, setNote] = useState(item?.note ?? "");
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
      if (item) {
        await updateBibliographyItem.mutateAsync({
          id: item.id,
          changes: fields,
        });
      } else {
        await createBibliographyItem.mutateAsync({ kind, ...fields });
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
      kicker={item ? "EDYCJA POZYCJI" : "NOWA POZYCJA"}
      title={item ? "Edytuj pozycję" : "Nowa pozycja"}
      titleId="item-dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Rodzaj"
          hint={item ? "Rodzaju nie można zmienić." : undefined}
        >
          <Select
            value={kind}
            disabled={item !== null}
            onChange={(event) => setKind(event.target.value as ItemKind)}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {ITEM_KIND_LABELS[option]}
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
          <Field label={ITEM_LENGTH_LABELS[kind]}>
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
              : item
                ? "Zapisz zmiany"
                : "Dodaj pozycję"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
