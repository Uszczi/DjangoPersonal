import { create } from "zustand";

import { apiErrorMessage } from "@/apiErrorMessage";
import { api } from "@/api";
import { type TaskResponse } from "@/generated/api";

export type TaskInput = {
  title: string;
  description: string;
  project: number;
};

export type TaskListState = { projectId: number; tasks: TaskResponse[] } | null;
export type TaskLoadError = { projectId: number; message: string } | null;

function orderTasks(tasks: TaskResponse[]) {
  return [...tasks].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted)
      return left.isCompleted ? 1 : -1;
    return left.id - right.id;
  });
}

type TasksState = {
  taskList: TaskListState;
  loadError: TaskLoadError;
  actionError: string;
  loadTasks: (projectId: number) => Promise<void>;
  saveTask: (input: TaskInput, task?: TaskResponse | null) => Promise<TaskResponse>;
  toggleTaskCompletion: (task: TaskResponse) => Promise<void>;
  startTaskTimer: (task: TaskResponse) => Promise<boolean>;
  confirmDelete: (task: TaskResponse) => Promise<void>;
};

let loadRequestId = 0;

export const useTasksStore = create<TasksState>((set) => ({
  taskList: null,
  loadError: null,
  actionError: "",

  loadTasks: async (projectId) => {
    const requestId = ++loadRequestId;

    try {
      const loadedTasks = await api.tasksList({ project: projectId });
      if (requestId !== loadRequestId) return;
      set({
        taskList: { projectId, tasks: orderTasks(loadedTasks) },
        loadError: null,
      });
    } catch {
      if (requestId === loadRequestId) {
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

  toggleTaskCompletion: async (task) => {
    set({ actionError: "" });

    try {
      const updatedTask = await api.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { isCompleted: !task.isCompleted },
      });
      upsertTask(set, task, updatedTask);
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
