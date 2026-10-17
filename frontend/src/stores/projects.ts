import { create } from "zustand";

import { api } from "@/api";
import { type ProjectResponse } from "@/generated/api";

export type ProjectInput = { name: string; description: string };

export function orderProjects(projects: ProjectResponse[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
}

/** The ProjectResponse a task falls back to: Inbox when present, otherwise the first ProjectResponse. */
export function defaultProject(projects: ProjectResponse[]) {
  return projects.find((item) => item.isInbox) ?? projects[0] ?? null;
}

type ProjectsState = {
  projects: ProjectResponse[];
  isLoading: boolean;
  pageError: string;
  loadProjects: () => Promise<void>;
  saveProject: (
    input: ProjectInput,
    project?: ProjectResponse | null,
  ) => Promise<ProjectResponse>;
  confirmProjectDelete: (project: ProjectResponse) => Promise<ProjectResponse | null>;
};

let loadRequestId = 0;

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: true,
  pageError: "",

  loadProjects: async () => {
    const requestId = ++loadRequestId;

    try {
      const loadedProjects = await api.projectsList();
      if (requestId !== loadRequestId) return;
      set({ projects: orderProjects(loadedProjects), pageError: "" });
    } catch {
      if (requestId === loadRequestId) {
        set({
          pageError:
            "Nie udało się wczytać projektów. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (requestId === loadRequestId) set({ isLoading: false });
    }
  },

  saveProject: async (input, project) => {
    if (project) {
      const updatedProject = await api.projectsPartialUpdate({
        id: project.id,
        patchedProjectRequest: input,
      });
      set((state) => ({
        projects: orderProjects(
          state.projects.map((item) =>
            item.id === updatedProject.id ? updatedProject : item,
          ),
        ),
      }));
      return updatedProject;
    }

    const createdProject = await api.projectsCreate({
      projectRequest: input,
    });
    set((state) => ({
      projects: orderProjects([...state.projects, createdProject]),
    }));
    return createdProject;
  },

  confirmProjectDelete: async (project) => {
    await api.projectsDestroy({ id: project.id });

    const remainingProjects = get().projects.filter(
      (item) => item.id !== project.id,
    );
    set({ projects: remainingProjects });
    return defaultProject(remainingProjects);
  },
}));
