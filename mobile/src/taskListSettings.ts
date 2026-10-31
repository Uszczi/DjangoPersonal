import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "@personal/shared/platform";

import type { HeaderAction } from "./ScreenHeader";

/**
 * How the task lists (the Zadania tab and a Project's screen) show their
 * rows, remembered on this device. Rehydrated in `app/_layout.tsx` once setup
 * has pointed `platformStorage` at secure storage.
 */
type TaskListSettingsState = {
  /** Whether every open Task's row has a button starting its timer. */
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

/** The header button opening the task list settings. */
export function taskListSettingsAction(onPress: () => void): HeaderAction {
  return {
    icon: "settings-outline",
    accessibilityLabel: "Ustawienia listy zadań",
    onPress,
  };
}
