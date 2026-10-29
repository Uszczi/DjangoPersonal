import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

/**
 * The status the last new Task got, per Project, so the next new Task in that
 * Project starts with it. Client state remembered on this device; a status the
 * Project no longer has falls back to its first one (`initialNewTaskStatus`).
 */
type NewTaskStatusState = {
  lastStatusByProject: Record<string, string>;
  rememberStatus: (projectId: number, status: string) => void;
};

export const useNewTaskStatusStore = create<NewTaskStatusState>()(
  persist(
    (set) => ({
      lastStatusByProject: {},
      rememberStatus: (projectId, status) =>
        set((state) => ({
          lastStatusByProject: {
            ...state.lastStatusByProject,
            [String(projectId)]: status,
          },
        })),
    }),
    {
      name: "newTaskStatus",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({
        lastStatusByProject: state.lastStatusByProject,
      }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<NewTaskStatusState> | undefined)
          ?.lastStatusByProject;
        if (!saved || typeof saved !== "object") return current;
        const valid = Object.fromEntries(
          Object.entries(saved).filter(
            ([, status]) => typeof status === "string",
          ),
        );
        return { ...current, lastStatusByProject: valid };
      },
    },
  ),
);

/** The status a new Task in a Project with `statuses` starts with. */
export function initialNewTaskStatus(
  lastStatusByProject: Record<string, string>,
  projectId: number,
  statuses: readonly string[],
): string {
  const last = lastStatusByProject[String(projectId)];
  return last !== undefined && statuses.includes(last)
    ? last
    : (statuses[0] ?? "");
}
