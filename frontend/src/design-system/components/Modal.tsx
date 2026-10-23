import type { HTMLAttributes, ReactNode } from "react";

import { IconButton } from "./IconButton";
import { useModalDialog } from "./useModalDialog";

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
 * A centered modal on the native `<dialog>` element (see `useModalDialog`); focuses its first
 * field. Render it only while open; it opens on mount and closes on unmount.
 */
export function Modal({
  kicker,
  title,
  titleId,
  onClose,
  size = "md",
  children,
}: ModalProps) {
  const dialogProps = useModalDialog(onClose, { focusFirstField: true });

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none items-start justify-center overflow-y-auto border-0 bg-overlay px-0 py-4 pt-16 text-ink backdrop:bg-transparent open:flex md:px-5 md:py-5 md:pt-[4vh]"
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
