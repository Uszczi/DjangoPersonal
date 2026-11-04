import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

/**
 * How the task lists show their rows, remembered on this device. The mobile
 * app rehydrates it in `app/_layout.tsx` once `platformStorage` is configured.
 */
type TaskListSettings = {
  /** Whether every Task's row has a button starting its timer. */
  showTimerButton: boolean;
  /**
   * Whether every Task's row shows its drag handle (mobile only: a long
   * press on the row still drags it).
   */
  showDragHandle: boolean;
  /** Whether a Task's row shows how many comments it has. */
  showCommentCount: boolean;
};

type TaskListSettingsState = TaskListSettings & {
  setShowTimerButton: (showTimerButton: boolean) => void;
  setShowDragHandle: (showDragHandle: boolean) => void;
  setShowCommentCount: (showCommentCount: boolean) => void;
};

/** The saved settings that are still booleans; anything else keeps its default. */
function savedSettings(persisted: unknown): Partial<TaskListSettings> {
  const saved = (persisted ?? {}) as Partial<
    Record<keyof TaskListSettings, unknown>
  >;
  const settings: Partial<TaskListSettings> = {};
  if (typeof saved.showTimerButton === "boolean") {
    settings.showTimerButton = saved.showTimerButton;
  }
  if (typeof saved.showDragHandle === "boolean") {
    settings.showDragHandle = saved.showDragHandle;
  }
  if (typeof saved.showCommentCount === "boolean") {
    settings.showCommentCount = saved.showCommentCount;
  }
  return settings;
}

export const useTaskListSettingsStore = create<TaskListSettingsState>()(
  persist(
    (set) => ({
      showTimerButton: true,
      showDragHandle: true,
      showCommentCount: true,
      setShowTimerButton: (showTimerButton) => set({ showTimerButton }),
      setShowDragHandle: (showDragHandle) => set({ showDragHandle }),
      setShowCommentCount: (showCommentCount) => set({ showCommentCount }),
    }),
    {
      name: "taskListSettings",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state): TaskListSettings => ({
        showTimerButton: state.showTimerButton,
        showDragHandle: state.showDragHandle,
        showCommentCount: state.showCommentCount,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...savedSettings(persisted),
      }),
    },
  ),
);
