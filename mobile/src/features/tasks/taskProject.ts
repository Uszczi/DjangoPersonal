import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ProjectResponse } from "@personal/shared/generated/api";
import { defaultProject } from "@personal/shared/queries/projects";
import { platformStorage } from "@personal/shared/platform";

/**
 * The Project the Zadania tab shows, remembered on this device (the web
 * remembers the last Project of its Tasks page the same way). Rehydrated in
 * `app/_layout.tsx` once setup has pointed `platformStorage` at secure
 * storage.
 */
type TaskProjectState = {
  projectId: number | null;
  setProjectId: (projectId: number) => void;
};

export const useTaskProjectStore = create<TaskProjectState>()(
  persist(
    (set) => ({
      projectId: null,
      setProjectId: (projectId) => set({ projectId }),
    }),
    {
      name: "taskProject",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ projectId: state.projectId }),
      merge: (persisted, current) => {
        const projectId = (persisted as Partial<TaskProjectState> | undefined)
          ?.projectId;
        return typeof projectId === "number"
          ? { ...current, projectId }
          : current;
      },
    },
  ),
);

/**
 * The remembered Project while the user still has it, else the default one
 * (the Inbox), so a deleted Project falls back without clearing the choice.
 */
export function selectedTaskProject(
  projects: ProjectResponse[],
  projectId: number | null,
): ProjectResponse | null {
  return (
    projects.find((item) => item.id === projectId) ?? defaultProject(projects)
  );
}
