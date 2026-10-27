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
import type { FolderResponse } from "@personal/shared/generated/api";
import { useCreateFolder, useRenameFolder } from "@/queries/folders";

type FolderEditorModalProps = {
  /** Omit to create a new folder; pass one to rename it. */
  folder?: FolderResponse | null;
  /** When creating: the Folder to create it in (omit for the top level). */
  parent?: FolderResponse | null;
  onClose: () => void;
};

export function FolderEditorModal({
  folder = null,
  parent = null,
  onClose,
}: FolderEditorModalProps) {
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();

  const [name, setName] = useState(folder?.name ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Podaj nazwę folderu.");
      return;
    }
    if (/[\s/]/.test(trimmed)) {
      setFormError("Nazwa folderu nie może zawierać spacji ani „/”.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      if (folder)
        await renameFolder.mutateAsync({ id: folder.id, name: trimmed });
      else
        await createFolder.mutateAsync({
          name: trimmed,
          parentId: parent?.id ?? null,
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
      kicker={
        folder ? "ZMIANA NAZWY" : parent ? "NOWY PODFOLDER" : "NOWY FOLDER"
      }
      title={
        folder
          ? "Zmień nazwę folderu"
          : parent
            ? `Nowy folder w „${parent.name}”`
            : "Nowy folder"
      }
      titleId="folder-dialog-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nazwa folderu" hint="Bez spacji i znaku „/”.">
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
              : folder
                ? "Zapisz zmiany"
                : "Utwórz folder"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
