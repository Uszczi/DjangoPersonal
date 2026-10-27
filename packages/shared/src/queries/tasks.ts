/**
 * A Project's Tasks as server state: one cached list per Project, plus the
 * writes that keep those lists in step with the server's answers.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "../api";
import type { ProjectResponse, TaskResponse } from "../generated/api";
import { projectKeys, taskKeys } from "./keys";

export type TaskInput = {
  title: string;
  description: string;
  project: number;
  status?: string;
};

/**
 * The server's order: by the Project's status order, then by position. A status
 * the Project no longer has sorts after the known ones.
 */
export function orderTasks(tasks: TaskResponse[], statuses: string[]) {
  const statusIndex = (task: TaskResponse) => {
    const index = statuses.indexOf(task.status);
    return index === -1 ? statuses.length : index;
  };
  return [...tasks].sort((left, right) => {
    const byStatus = statusIndex(left) - statusIndex(right);
    if (byStatus !== 0) return byStatus;
    const leftPosition = left.position ?? left.id;
    const rightPosition = right.position ?? right.id;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return left.id - right.id;
  });
}

export const projectTasksQuery = (projectId: number) =>
  queryOptions({
    queryKey: taskKeys.project(projectId),
    queryFn: ({ signal }) => api.tasksList({ project: projectId }, { signal }),
  });

export const allTasksQuery = queryOptions({
  queryKey: taskKeys.everything,
  queryFn: ({ signal }) => api.tasksList({ all: true }, { signal }),
});

/**
 * The Project's Tasks in the server's order; `null` waits for a Project. The
 * order needs the Project's statuses, so pass the Project itself.
 */
export function useProjectTasks(project: ProjectResponse | null) {
  const statuses = project?.projectStatuses;
  const select = useCallback(
    (tasks: TaskResponse[]) => orderTasks(tasks, statuses ?? []),
    [statuses],
  );
  return useQuery({
    ...projectTasksQuery(project?.id ?? 0),
    enabled: project !== null,
    select,
  });
}

export function useAllTasks() {
  return useQuery(allTasksQuery);
}

/** Change one Project's cached list, if it is loaded. */
export function updateProjectTasks(
  queryClient: QueryClient,
  projectId: number,
  update: (tasks: TaskResponse[]) => TaskResponse[],
) {
  queryClient.setQueryData(
    projectTasksQuery(projectId).queryKey,
    (tasks) => tasks && update(tasks),
  );
}

/** Put a saved Task into its Project's list, and out of the one it left. */
function placeTask(
  queryClient: QueryClient,
  saved: TaskResponse,
  previous?: TaskResponse | null,
) {
  if (previous && previous.projectId !== saved.projectId) {
    updateProjectTasks(queryClient, previous.projectId, (tasks) =>
      tasks.filter((item) => item.id !== saved.id),
    );
  }
  updateProjectTasks(queryClient, saved.projectId, (tasks) => [
    ...tasks.filter((item) => item.id !== saved.id),
    saved,
  ]);
  // The timer's picker lists every Task by title; let it refetch when next shown.
  void queryClient.invalidateQueries({ queryKey: taskKeys.everything });
}

/** Create (no `task`) or update a Task. */
export function useSaveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      task,
    }: {
      input: TaskInput;
      task?: TaskResponse | null;
    }) =>
      task
        ? api.tasksPartialUpdate({
            id: task.id,
            patchedTaskUpdateRequest: input,
          })
        : api.tasksCreate({ taskCreateRequest: input }),
    onSuccess: (saved, { task }) => placeTask(queryClient, saved, task),
  });
}

/** Mark a Task done (its Project's terminal status), or reopen a done one. */
export function useToggleTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: TaskResponse) => {
      const project = queryClient
        .getQueryData<ProjectResponse[]>(projectKeys.all)
        ?.find((item) => item.id === task.projectId);
      const statuses = project?.projectStatuses ?? [];
      const terminal = project?.terminalStatus ?? statuses[statuses.length - 1];
      const status = task.status === terminal ? statuses[0] : terminal;
      return api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { status },
      });
    },
    onSuccess: (saved, task) => placeTask(queryClient, saved, task),
  });
}

/**
 * Move a Task to `position` within `status` (its own when omitted). The
 * server renumbers its neighbours, so the list is reloaded either way and a
 * refused move snaps back.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      task,
      position,
      status,
    }: {
      task: TaskResponse;
      position: number;
      status?: string;
    }) =>
      api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { position, ...(status ? { status } : {}) },
      }),
    onSettled: (_, __, { task }) =>
      queryClient.invalidateQueries({
        queryKey: taskKeys.project(task.projectId),
      }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: TaskResponse) => api.tasksDestroy({ id: task.id }),
    onSuccess: (_, task) => {
      updateProjectTasks(queryClient, task.projectId, (tasks) =>
        tasks.filter((item) => item.id !== task.id),
      );
      void queryClient.invalidateQueries({ queryKey: taskKeys.everything });
    },
  });
}
