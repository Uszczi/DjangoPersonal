import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { IconButton } from "./IconButton";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  /** Draws the item in the danger colour (e.g. a delete). */
  isDanger?: boolean;
  onSelect: () => void;
};

/**
 * An icon button that opens a short list of actions below it. The list closes
 * on a choice, on Escape and on a click outside it.
 */
export function MenuButton({
  label,
  icon,
  items,
}: {
  /** Accessible name of the button, e.g. "Opcje licznika". */
  label: string;
  icon: ReactNode;
  items: MenuItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        {icon}
      </IconButton>
      {isOpen && (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute top-full right-0 z-20 mt-1 min-w-[12rem] list-none rounded-lg border border-row-line bg-paper p-1 shadow-dialog"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-left font-inherit text-[14px] hover:bg-wash focus-visible:outline-2 focus-visible:outline-accent ${item.isDanger ? "text-danger" : "text-ink"}`}
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
