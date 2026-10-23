import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

import { IconButton } from "./IconButton";

type ModalProps = {
  kicker: ReactNode;
  title: ReactNode;
  /** The `id` put on the title `<h2>` and referenced by the dialog's `aria-labelledby`. */
  titleId: string;
  /** Called on backdrop click, Escape and the close button; modals guard it themselves (e.g. while saving). */
  onClose: () => void;
  /** `md` is 430px (confirm dialogs), `lg` is 480px (editors). */
  size?: "md" | "lg";
  children: ReactNode;
};

const sectionClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-[430px]",
  lg: "max-w-[480px]",
};

/**
 * A modal on the native `<dialog>` element: `showModal()` puts it in the top layer, makes the
 * rest of the page inert (focus stays inside) and turns Escape into a `cancel` event.
 * Render it only while open; it opens on mount and closes on unmount.
 */
export function Modal({
  kicker,
  title,
  titleId,
  onClose,
  size = "md",
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    // `autoFocus` runs before the dialog is open, so focus the first field here; confirm
    // dialogs without fields keep the browser default (the first button).
    dialog
      .querySelector<HTMLElement>("input:not(:disabled), textarea:not(:disabled), select:not(:disabled)")
      ?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-start justify-center overflow-y-auto border-0 bg-overlay px-0 py-4 pt-16 text-ink backdrop:bg-transparent open:flex md:items-center md:px-5 md:py-5 md:pt-5"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        // The browser may close the dialog without a cancelable `cancel` (e.g. a repeated
        // Escape). Keep React in charge: ask the owner to close, and stay open if it refuses.
        const dialog = event.currentTarget;
        if (dialog.open) return;
        onClose();
        dialog.showModal();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`w-full ${sectionClasses[size]} rounded-lg border border-line bg-paper p-[29px] shadow-dialog animate-dialog-enter`}
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              {kicker}
            </p>
            <h2
              id={titleId}
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              {title}
            </h2>
          </div>
          <IconButton onClick={onClose} aria-label="Zamknij">
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        {children}
      </section>
    </dialog>
  );
}

export function ModalFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-[26px] flex justify-end gap-[9px] border-t border-line-soft pt-[18px] ${className}`.trim()}
      {...props}
    />
  );
}
