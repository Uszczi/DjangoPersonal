import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

/**
 * How the task lists show their rows, remembered on this device. The mobile
 * app rehydrates it in `app/_layout.tsx` once `platformStorage` is configured.
 */
type TaskListSettingsState = {
  /** Whether every Task's row has a button starting its timer. */
  showTimerButton: boolean;
  setShowTimerButton: (showTimerButton: boolean) => void;
};

export const useTaskListSettingsStore = create<TaskListSettingsState>()(
  persist(
    (set) => ({
      showTimerButton: true,
      setShowTimerButton: (showTimerButton) => set({ showTimerButton }),
    }),
    {
      name: "taskListSettings",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ showTimerButton: state.showTimerButton }),
      merge: (persisted, current) => {
        const showTimerButton = (
          persisted as Partial<TaskListSettingsState> | undefined
        )?.showTimerButton;
        return typeof showTimerButton === "boolean"
          ? { ...current, showTimerButton }
          : current;
      },
    },
  ),
);
