import type { HTMLAttributes, Ref } from "react";

type DragHandleProps = HTMLAttributes<HTMLSpanElement> & {
  ref?: Ref<HTMLSpanElement>;
};

/**
 * The grip a sortable row is dragged by; spread dnd-kit's `attributes` and
 * `listeners` onto it. `touch-none` keeps the browser from claiming a touch on
 * the handle for scrolling, which would cancel the drag on phones.
 */
export function DragHandle({
  className = "",
  title = "Przeciągnij",
  ...props
}: DragHandleProps) {
  return (
    <span
      title={title}
      className={`-m-1.5 inline-flex shrink-0 cursor-grab touch-none items-center justify-center p-1.5 text-[14px] text-drag-handle transition-colors select-none hover:text-muted ${className}`.trim()}
      {...props}
    >
      <span aria-hidden="true">⠿</span>
    </span>
  );
}
