import { create } from "zustand";

import { apiErrorMessage } from "@/apiErrorMessage";
import { api } from "@/api";
import { type TaskResponse } from "@/generated/api";
import { useProjectsStore } from "@/stores/projects";
import { createLoadGuard } from "@/stores/loadGuard";

export type TaskInput = {
  title: string;
  description: string;
  project: number;
  status?: string;
};

export type TaskListState = { projectId: number; tasks: TaskResponse[] } | null;
export type TaskLoadError = { projectId: number; message: string } | null;

function findProject(projectId: number) {
  return useProjectsStore.getState().projects.find((p) => p.id === projectId);
}

function projectStatuses(projectId: number): string[] {
  return findProject(projectId)?.projectStatuses ?? [];
}

function projectTerminalStatus(projectId: number): string | undefined {
  return findProject(projectId)?.terminalStatus;
}

function statusIndex(task: TaskResponse): number {
  const statuses = projectStatuses(task.projectId);
  const index = statuses.indexOf(task.status);
  return index === -1 ? statuses.length : index;
}

function orderTasks(tasks: TaskResponse[]) {
  return [...tasks].sort((left, right) => {
    const leftIndex = statusIndex(left);
    const rightIndex = statusIndex(right);
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    const leftPosition = left.position ?? left.id;
    const rightPosition = right.position ?? right.id;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    return left.id - right.id;
  });
}

type TasksState = {
  taskList: TaskListState;
  loadError: TaskLoadError;
  actionError: string;
  loadTasks: (projectId: number) => Promise<void>;
  saveTask: (input: TaskInput, task?: TaskResponse | null) => Promise<TaskResponse>;
  toggleTaskStatus: (task: TaskResponse) => Promise<void>;
  moveTask: (task: TaskResponse, direction: "up" | "down") => Promise<void>;
  startTaskTimer: (task: TaskResponse) => Promise<boolean>;
  confirmDelete: (task: TaskResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

export const useTasksStore = create<TasksState>((set) => ({
  taskList: null,
  loadError: null,
  actionError: "",

  loadTasks: async (projectId) => {
    const requestId = loadGuard.nextRequestId();

    try {
      const loadedTasks = await api.tasksList({ project: projectId });
      if (!loadGuard.isLatest(requestId)) return;
      set({
        taskList: { projectId, tasks: orderTasks(loadedTasks) },
        loadError: null,
      });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          loadError: {
            projectId,
            message: "Nie udało się wczytać zadań. Spróbuj ponownie.",
          },
        });
      }
    }
  },

  saveTask: async (input, task) => {
    if (task) {
      const updatedTask = await api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: input,
      });
      upsertTask(set, task, updatedTask);
      return updatedTask;
    }

    const createdTask = await api.tasksCreate({
      taskCreateRequest: input,
    });
    set((state) => {
      const current = state.taskList;
      const visibleTasks =
        current && current.projectId === input.project ? current.tasks : [];

      return {
        taskList: {
          projectId: input.project,
          tasks: orderTasks([...visibleTasks, createdTask]),
        },
        loadError: null,
      };
    });
    return createdTask;
  },

  toggleTaskStatus: async (task) => {
    set({ actionError: "" });

    try {
      const statuses = projectStatuses(task.projectId);
      const terminal =
        projectTerminalStatus(task.projectId) ?? statuses[statuses.length - 1];
      const nextStatus = task.status === terminal ? statuses[0] : terminal;
      const updatedTask = await api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { status: nextStatus },
      });
      upsertTask(set, task, updatedTask);
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  moveTask: async (task, direction) => {
    const current = useTasksStore.getState().taskList;
    if (!current || current.projectId !== task.projectId) return;

    const siblings = current.tasks.filter((item) => item.status === task.status);
    const index = siblings.findIndex((item) => item.id === task.id);
    if (index < 0) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    set({ actionError: "" });
    try {
      await api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { position: targetIndex },
      });
      await useTasksStore.getState().loadTasks(current.projectId);
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },


  startTaskTimer: async (task) => {
    set({ actionError: "" });

    try {
      await api.timerStart({ timerStartRequest: { task: task.id } });
      return true;
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
      return false;
    }
  },

  confirmDelete: async (task) => {
    await api.tasksDestroy({ id: task.id });

    set((state) => ({
      taskList: state.taskList
        ? {
            projectId: state.taskList.projectId,
            tasks: state.taskList.tasks.filter((item) => item.id !== task.id),
          }
        : state.taskList,
    }));
  },
}));

/**
 * Reflect a TaskResponse update in the list without letting a late response clobber a
 * ProjectResponse that was selected in the meantime.
 */
function upsertTask(
  set: (partial: Partial<TasksState> | ((state: TasksState) => Partial<TasksState>)) => void,
  previousTask: TaskResponse,
  updatedTask: TaskResponse,
) {
  set((state) => {
    const current = state.taskList;
    if (!current) return {};

    const taskWasVisible = current.tasks.some(
      (task) => task.id === previousTask.id,
    );
    const taskBelongsInList = updatedTask.projectId === current.projectId;
    if (!taskWasVisible && !taskBelongsInList) return {};

    const visibleTasks = taskBelongsInList
      ? [
          ...current.tasks.filter((task) => task.id !== updatedTask.id),
          updatedTask,
        ]
      : current.tasks.filter((task) => task.id !== updatedTask.id);

    return { taskList: { projectId: current.projectId, tasks: orderTasks(visibleTasks) } };
  });

  set((state) => {
    const current = state.loadError;
    if (
      current &&
      (current.projectId === previousTask.projectId ||
        current.projectId === updatedTask.projectId)
    ) {
      return { loadError: null };
    }
    return {};
  });
}
