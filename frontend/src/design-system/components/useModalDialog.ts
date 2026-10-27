import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from "react";

/**
 * Shared behaviour of the design system's native `<dialog>` overlays (`Modal`, `Drawer`):
 * `showModal()` on mount puts the dialog in the top layer and makes the rest of the page inert,
 * Escape and backdrop clicks are routed to `onClose`, and the dialog closes on unmount.
 * The owner decides whether to actually close (e.g. not while saving).
 */
export function useModalDialog(
  onClose: () => void,
  { focusFirstField = false } = {},
) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    if (focusFirstField) {
      // `autoFocus` runs before the dialog is open, so focus the first field here; without
      // one the browser default applies (the first focusable element).
      dialog
        .querySelector<HTMLElement>(
          "input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
        )
        ?.focus();
    }
    return () => dialog.close();
  }, [focusFirstField]);

  return {
    ref,
    onCancel(event: SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault();
      onClose();
    },
    onClose(event: SyntheticEvent<HTMLDialogElement>) {
      // The browser may close the dialog without a cancelable `cancel` (e.g. a repeated
      // Escape). Keep React in charge: ask the owner to close, and stay open if it refuses.
      const dialog = event.currentTarget;
      if (dialog.open) return;
      onClose();
      dialog.showModal();
    },
    onMouseDown(event: MouseEvent<HTMLDialogElement>) {
      if (event.target === event.currentTarget) onClose();
    },
  };
}
