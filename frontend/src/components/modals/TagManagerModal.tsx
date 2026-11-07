import { useState, type FormEvent } from "react";

import { ColorPicker } from "@/components/ColorPicker";
import { TagChip } from "@/components/tags/TagChip";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TagResponse } from "@personal/shared/generated/api";
import {
  useDeleteTag,
  useTags,
  useUpdateTag,
} from "@personal/shared/queries/tags";

/** Every Tag, each renamed, recoloured or deleted in place. New Tags come from the Task editor. */
export function TagManagerModal({ onClose }: { onClose: () => void }) {
  const { data: tags = [] } = useTags();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Modal
      kicker="ZADANIA"
      title="Tagi"
      titleId="tag-manager-title"
      onClose={onClose}
    >
      {tags.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">
          Nie masz jeszcze tagów. Dodasz je w edytorze zadania.
        </p>
      ) : (
        <ul aria-label="Tagi" className="mt-4 grid gap-1">
          {tags.map((tag) =>
            tag.id === editingId ? (
              <li key={tag.id}>
                <TagEditor tag={tag} onDone={() => setEditingId(null)} />
              </li>
            ) : (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-1"
              >
                <TagChip tag={tag} />
                <Button
                  variant="ghost"
                  aria-label={`Edytuj tag: ${tag.name}`}
                  onClick={() => setEditingId(tag.id)}
                >
                  Edytuj
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Gotowe
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function TagEditor({ tag, onDone }: { tag: TagResponse; onDone: () => void }) {
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const isBusy = updateTag.isPending || deleteTag.isPending;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await updateTag.mutateAsync({ tag, input: { name: name.trim(), color } });
      onDone();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  async function remove() {
    setError("");
    try {
      await deleteTag.mutateAsync(tag);
      onDone();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <form
      onSubmit={save}
      aria-label={`Edycja tagu: ${tag.name}`}
      className="rounded-lg border border-card-line bg-paper p-3"
    >
      <Field label="Nazwa tagu">
        <TextInput
          value={name}
          maxLength={50}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <ColorPicker
        value={color}
        onChange={setColor}
        name={`tag-color-${tag.id}`}
      />
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghostDanger"
          className="mr-auto"
          onClick={() =>
            confirmDelete ? void remove() : setConfirmDelete(true)
          }
          disabled={isBusy}
        >
          {confirmDelete ? "Usuń z wszystkich zadań" : "Usuń"}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={isBusy}>
          Anuluj
        </Button>
        <Button variant="primary" type="submit" disabled={isBusy}>
          Zapisz
        </Button>
      </div>
    </form>
  );
}
