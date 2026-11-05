import { create } from "zustand";

/**
 * Why the server refused a write sent from the Outbox after the screen that
 * made it stopped waiting (it was queued offline, or the app restarted). The
 * screen that made a write waits for it while online and shows its own error;
 * this store only covers the late ones, so they are not lost silently.
 */
type OutboxErrorsState = {
  message: string | null;
  report: (message: string) => void;
  dismiss: () => void;
};

export const useOutboxErrorsStore = create<OutboxErrorsState>((set) => ({
  message: null,
  report: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}));
