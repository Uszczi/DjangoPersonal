import { create } from "zustand";

import { apiErrorMessage } from "../apiErrorMessage";
import { Configuration, ProjectsApi, type Project } from "../generated/api";

const projectsApi = new ProjectsApi(new Configuration({ basePath: "" }));

export type ProjectEditorState =
  | { kind: "create" }
  | { kind: "edit"; project: Project }
  | null;

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
  editor: ProjectEditorState;
  pendingDelete: Project | null;
  projectDeleteError: string;
  loadProjects: () => Promise<void>;
  openCreateForm: () => void;
  openEditProject: (project: Project) => void;
  closeEditor: () => void;
  saveProject: (input: ProjectInput) => Promise<Project>;
  openProjectDeleteDialog: (project: Project) => void;
  closeProjectDeleteDialog: () => void;
  confirmProjectDelete: () => Promise<Project | null>;
};

let loadRequestId = 0;

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: true,
  pageError: "",
  editor: null,
  pendingDelete: null,
  projectDeleteError: "",

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

  openCreateForm: () => set({ editor: { kind: "create" } }),

  openEditProject: (project) => set({ editor: { kind: "edit", project } }),

  closeEditor: () => set({ editor: null }),

  saveProject: async (input) => {
    const editor = get().editor;
    if (!editor) throw new Error("Brak otwartego edytora projektu.");

    if (editor.kind === "edit") {
      const updatedProject = await projectsApi.projectsPartialUpdate({
        id: editor.project.id,
        patchedProjectRequest: input,
      });
      set((state) => ({
        projects: orderProjects(
          state.projects.map((item) =>
            item.id === updatedProject.id ? updatedProject : item,
          ),
        ),
        editor: null,
      }));
      return updatedProject;
    }

    const createdProject = await projectsApi.projectsCreate({
      projectRequest: input,
    });
    set((state) => ({
      projects: orderProjects([...state.projects, createdProject]),
      editor: null,
    }));
    return createdProject;
  },

  openProjectDeleteDialog: (project) =>
    set({ pendingDelete: project, projectDeleteError: "" }),

  closeProjectDeleteDialog: () => set({ pendingDelete: null }),

  confirmProjectDelete: async () => {
    const { pendingDelete } = get();
    if (!pendingDelete) return null;

    try {
      await projectsApi.projectsDestroy({ id: pendingDelete.id });
    } catch (error) {
      set({ projectDeleteError: await apiErrorMessage(error) });
      throw error;
    }

    const remainingProjects = get().projects.filter(
      (item) => item.id !== pendingDelete.id,
    );
    set({ projects: remainingProjects, pendingDelete: null });
    return defaultProject(remainingProjects);
  },
}));
