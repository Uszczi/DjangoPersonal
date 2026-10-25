import type { ReactNode } from "react";

import { IconButton } from "./IconButton";
import { useModalDialog } from "./useModalDialog";

type DrawerProps = {
  /** Header content next to the close button. */
  title: ReactNode;
  /** Accessible name of the dialog. */
  label: string;
  /** Put on the `<dialog>`, so a toggle can point at it with `aria-controls`. */
  id?: string;
  /** The edge the panel sits at and slides in from. */
  side?: "left" | "right";
  /** Called on backdrop click, Escape and the close button. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * A panel sliding in at the top right (or left, with `side`), on the native `<dialog>` element (see `useModalDialog`).
 * Render it only while open; it opens on mount and closes on unmount.
 */
export function Drawer({ title, label, id, side = "right", onClose, children }: DrawerProps) {
  const dialogProps = useModalDialog(onClose);

  return (
    <dialog
      {...dialogProps}
      id={id}
      aria-label={label}
      className={`fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-start border-0 bg-overlay p-5 text-ink backdrop:bg-transparent open:flex ${side === "left" ? "justify-start" : "justify-end"}`}
    >
      <div className={`flex min-h-[200px] w-full max-w-[320px] flex-col gap-5 rounded-lg border border-line bg-paper p-[29px] shadow-dialog ${side === "left" ? "animate-nav-enter-left" : "animate-nav-enter"}`}>
        <div className="flex items-center justify-between">
          {title}
          <IconButton onClick={onClose} aria-label="Zamknij">
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
