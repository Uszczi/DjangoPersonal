import type { TagResponse } from "@personal/shared/generated/api";
import { TagManagerModal } from "@/components/modals/TagManagerModal";
import { ShowModal } from "@/stores/modal";

import { TagDot } from "./TagChip";

type TagFilterProps = {
  tags: TagResponse[];
  /** The Tag the list is narrowed to, or `undefined` for every Task. */
  selected: string | undefined;
  onSelect: (tagId: string | undefined) => void;
};

/** Narrows the Task list to one Tag; choosing the chosen Tag again shows every Task. */
export function TagFilter({ tags, selected, onSelect }: TagFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtruj po tagu"
      className="mb-4 flex flex-wrap items-center gap-1.5"
    >
      {tags.map((tag) => {
        const isSelected = tag.id === selected;
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? undefined : tag.id)}
            className={
              isSelected
                ? "inline-flex items-center gap-1.5 rounded-full border border-ink bg-paper px-2.5 py-1 text-[12px] font-medium text-ink"
                : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-wash px-2.5 py-1 text-[12px] text-ink-soft hover:text-ink"
            }
          >
            <TagDot color={tag.color} />
            {tag.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => ShowModal(TagManagerModal)}
        className="rounded-full px-2.5 py-1 text-[12px] text-muted hover:bg-wash hover:text-ink"
      >
        Zarządzaj tagami
      </button>
    </div>
  );
}
