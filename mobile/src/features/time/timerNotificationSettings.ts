import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "@personal/shared/platform";

/**
 * Whether a running timer keeps a notification in the status bar, remembered
 * on this device. Rehydrated in `app/_layout.tsx` once setup has pointed
 * `platformStorage` at secure storage.
 */
type TimerNotificationSettingsState = {
  showOngoing: boolean;
  setShowOngoing: (showOngoing: boolean) => void;
};

export const useTimerNotificationSettingsStore =
  create<TimerNotificationSettingsState>()(
    persist(
      (set) => ({
        showOngoing: true,
        setShowOngoing: (showOngoing) => set({ showOngoing }),
      }),
      {
        name: "timerNotificationSettings",
        storage: createJSONStorage(() => platformStorage),
        partialize: (state) => ({ showOngoing: state.showOngoing }),
        merge: (persisted, current) => {
          const showOngoing = (
            persisted as Partial<TimerNotificationSettingsState> | undefined
          )?.showOngoing;
          return typeof showOngoing === "boolean"
            ? { ...current, showOngoing }
            : current;
        },
      },
    ),
  );
