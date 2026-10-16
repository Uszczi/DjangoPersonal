import { create } from "zustand";

import { Configuration, ProjectsApi, type Project } from "../generated/api";

const projectsApi = new ProjectsApi(new Configuration({ basePath: "" }));

export type ProjectInput = { name: string; description: string };

export function orderProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
}

/** The Project a task falls back to: Inbox when present, otherwise the first Project. */
export function defaultProject(projects: Project[]) {
  return projects.find((item) => item.isInbox) ?? projects[0] ?? null;
}

type ProjectsState = {
  projects: Project[];
  isLoading: boolean;
  pageError: string;
  loadProjects: () => Promise<void>;
  saveProject: (
    input: ProjectInput,
    project?: Project | null,
  ) => Promise<Project>;
  confirmProjectDelete: (project: Project) => Promise<Project | null>;
};

let loadRequestId = 0;

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: true,
  pageError: "",

  loadProjects: async () => {
    const requestId = ++loadRequestId;

    try {
      const loadedProjects = await projectsApi.projectsList();
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
      const updatedProject = await projectsApi.projectsPartialUpdate({
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

    const createdProject = await projectsApi.projectsCreate({
      projectRequest: input,
    });
    set((state) => ({
      projects: orderProjects([...state.projects, createdProject]),
    }));
    return createdProject;
  },

  confirmProjectDelete: async (project) => {
    await projectsApi.projectsDestroy({ id: project.id });

    const remainingProjects = get().projects.filter(
      (item) => item.id !== project.id,
    );
    set({ projects: remainingProjects });
    return defaultProject(remainingProjects);
  },
}));
