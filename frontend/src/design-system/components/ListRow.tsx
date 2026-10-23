import type { LiHTMLAttributes, ReactNode, Ref } from "react";

type ListRowProps = Omit<LiHTMLAttributes<HTMLLIElement>, "children"> & {
  ref?: Ref<HTMLLIElement>;
  /** Exactly two children: what sits at the left edge and what sits at the right. */
  children: [ReactNode, ReactNode];
};

/**
 * One row of a bordered list with its two children pushed to opposite edges.
 * The left one takes the free width and its text truncates; the right one
 * keeps its size. When the row is too narrow to give the left side 14rem,
 * the right side wraps onto a second line, still at the right edge. `ref`,
 * `style` and the other `<li>` attributes pass through, so a sortable list can
 * hand in dnd-kit's.
 */
export function ListRow({ children: [start, end], className = "", ref, ...props }: ListRowProps) {
  return (
    <li
      ref={ref}
      className={`flex min-h-[62px] flex-wrap items-center justify-between gap-x-[13px] gap-y-1 border-b border-row-line px-[3px] py-[10px] ${className}`.trim()}
      {...props}
    >
      <div className="flex min-w-[min(100%,14rem)] flex-1 items-center gap-[13px]">{start}</div>
      <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div>
    </li>
  );
}

/** The row's name; truncates. Wrap it with `ListRowSubtitle`s in a `min-w-0` block. */
export function ListRowTitle({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={`truncate text-[14px] font-medium leading-snug text-ink ${className}`.trim()}>
      {children}
    </p>
  );
}

export function ListRowSubtitle({ children }: { children: ReactNode }) {
  return (
    <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">
      {children}
    </small>
  );
}
