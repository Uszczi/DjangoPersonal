import type { TagResponse } from "@personal/shared/generated/api";

/** A Tag as a small chip: its colour as a dot, then its name. */
export function TagChip({ tag }: { tag: TagResponse }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-wash px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      <TagDot color={tag.color} />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

export function TagDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}
