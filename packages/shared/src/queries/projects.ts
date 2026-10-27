/**
 * Projects as server state: the list query and the writes that keep the
 * cached list in step with the server's answers.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { ProjectResponse } from "../generated/api";
import { projectKeys, taskKeys } from "./keys";

export type ProjectInput = {
  name: string;
  description: string;
  projectStatuses?: string[];
  terminalStatus?: string;
};

/** The server's order: the Inbox first, then by position, then by name. */
export function orderProjects(projects: ProjectResponse[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1;
    const leftPosition = left.position ?? 0;
    const rightPosition = right.position ?? 0;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
}

/** The Project a task falls back to: the Inbox when present, otherwise the first Project. */
export function defaultProject(projects: ProjectResponse[]) {
  return projects.find((item) => item.isInbox) ?? projects[0] ?? null;
}

/** The cache holds the list as the server sent it; `useProjects` orders it. */
export const projectsQuery = queryOptions({
  queryKey: projectKeys.all,
  queryFn: ({ signal }) => api.projectsList({ signal }),
});

export function useProjects() {
  return useQuery({ ...projectsQuery, select: orderProjects });
}

/** Create (no `project`) or update a Project; the answer replaces it in the list. */
export function useSaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      project,
    }: {
      input: ProjectInput;
      project?: ProjectResponse | null;
    }) =>
      project
        ? api.projectsPartialUpdate({
            id: project.id,
            patchedProjectRequest: input,
          })
        : api.projectsCreate({ projectRequest: input }),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        projectsQuery.queryKey,
        (list) =>
          list && [...list.filter((item) => item.id !== saved.id), saved],
      );
    },
  });
}

/** Move a Project to `position`; the list is reloaded either way, so a refused move snaps back. */
export function useMoveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, position }: { id: number; position: number }) =>
      api.projectsPartialUpdate({ id, patchedProjectRequest: { position } }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: ProjectResponse) =>
      api.projectsDestroy({ id: project.id }),
    onSuccess: (_, project) => {
      queryClient.setQueryData(projectsQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== project.id),
      );
      // Its Tasks went with it.
      queryClient.removeQueries({ queryKey: taskKeys.project(project.id) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.everything });
    },
  });
}
