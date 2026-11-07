import { useState, type KeyboardEvent } from "react";

import { Button, TextInput } from "@/design-system";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  findTagByName,
  nextTagColor,
  useCreateTag,
  useTags,
} from "@personal/shared/queries/tags";

import { TagDot } from "./TagChip";

type TagPickerProps = {
  /** The ids of the chosen Tags. */
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
};

/**
 * The Task editor's Tags: every Tag as a toggle, and a field that picks the
 * Tag it names or creates it. A group rather than a `Field`, because `Field`
 * nests a single control in its `<label>`.
 */
export function TagPicker({
  value,
  onChange,
  disabled = false,
}: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const chosen = new Set(value);

  function toggle(tagId: string) {
    onChange(
      chosen.has(tagId)
        ? value.filter((id) => id !== tagId)
        : [...value, tagId],
    );
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    const existing = findTagByName(tags, trimmed);
    if (existing) {
      if (!chosen.has(existing.id)) onChange([...value, existing.id]);
      setName("");
      return;
    }
    try {
      const created = await createTag.mutateAsync({
        name: trimmed,
        color: nextTagColor(tags),
      });
      onChange([...value, created.id]);
      setName("");
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the Tag instead of submitting the Task's form.
    if (event.key === "Enter") {
      event.preventDefault();
      void add();
    }
  }

  return (
    <div
      role="group"
      aria-labelledby="task-tags-label"
      className="mb-[18px] grid gap-2"
    >
      <span
        id="task-tags-label"
        className="text-[12px] font-semibold text-ink-soft"
      >
        Tagi
      </span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const isChosen = chosen.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={isChosen}
                disabled={disabled}
                onClick={() => toggle(tag.id)}
                className={
                  isChosen
                    ? "inline-flex items-center gap-1.5 rounded-full border border-ink bg-paper px-2.5 py-1 text-[12px] font-medium text-ink"
                    : "inline-flex items-center gap-1.5 rounded-full border border-control-border bg-transparent px-2.5 py-1 text-[12px] text-ink-soft hover:border-control-border-hover hover:text-ink"
                }
              >
                <TagDot color={tag.color} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <TextInput
            aria-label="Nowy tag"
            placeholder="Dodaj tag…"
            maxLength={50}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            variant="secondary"
            onClick={() => void add()}
            disabled={!name.trim() || createTag.isPending}
          >
            Dodaj
          </Button>
        </div>
      )}
      {error && <p className="m-0 text-[12px] text-danger-ink">{error}</p>}
    </div>
  );
}
