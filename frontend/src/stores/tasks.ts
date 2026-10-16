import { create } from "zustand";

import { apiErrorMessage } from "../apiErrorMessage";
import { Configuration, TasksApi, TimerApi, type Task } from "../generated/api";

const tasksApi = new TasksApi(new Configuration({ basePath: "" }));
const timerApi = new TimerApi(new Configuration({ basePath: "" }));

export type TaskInput = {
  title: string;
  description: string;
  project?: number;
};

export type TaskEditInput = {
  title: string;
  description: string;
  projectId: number;
};

export type TaskListState = { projectId: number; tasks: Task[] } | null;
export type TaskLoadError = { projectId: number; message: string } | null;

function orderTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted)
      return left.isCompleted ? 1 : -1;
    return left.id - right.id;
  });
}

type TasksState = {
  taskList: TaskListState;
  loadError: TaskLoadError;
  isEditorOpen: boolean;
  editingTask: Task | null;
  pendingDelete: Task | null;
  actionError: string;
  deleteError: string;
  loadTasks: (projectId: number) => Promise<void>;
  openCreateForm: () => void;
  closeEditor: () => void;
  openEditForm: (task: Task) => void;
  closeEditForm: () => void;
  createTask: (input: TaskInput, projectId: number | null) => Promise<void>;
  toggleTaskCompletion: (task: Task) => Promise<void>;
  startTaskTimer: (task: Task) => Promise<boolean>;
  openDeleteDialog: (task: Task) => void;
  closeDeleteDialog: () => void;
  confirmDelete: () => Promise<void>;
  updateTask: (task: Task, input: TaskEditInput) => Promise<void>;
};

let loadRequestId = 0;

export const useTasksStore = create<TasksState>((set, get) => ({
  taskList: null,
  loadError: null,
  isEditorOpen: false,
  editingTask: null,
  pendingDelete: null,
  actionError: "",
  deleteError: "",

  loadTasks: async (projectId) => {
    const requestId = ++loadRequestId;

    try {
      const loadedTasks = await tasksApi.tasksList({ project: projectId });
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

  openCreateForm: () => set({ isEditorOpen: true }),

  closeEditor: () => set({ isEditorOpen: false }),

  openEditForm: (task) => set({ editingTask: task }),

  closeEditForm: () => set({ editingTask: null }),

  createTask: async (input, projectId) => {
    const createdTask = await tasksApi.tasksCreate({
      taskCreateRequest: input,
    });

    set((state) => {
      const current = state.taskList;
      const belongsInCurrentList =
        projectId !== null && current?.projectId === projectId;

      return {
        taskList:
          projectId === null
            ? current
            : {
                projectId,
                tasks: orderTasks([
                  ...(belongsInCurrentList ? current.tasks : []),
                  createdTask,
                ]),
              },
        loadError: null,
        isEditorOpen: false,
      };
    });
  },

  toggleTaskCompletion: async (task) => {
    set({ actionError: "" });

    try {
      const updatedTask = await tasksApi.tasksPartialUpdate({
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
      await timerApi.timerStart({ timerStartRequest: { task: task.id } });
      return true;
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
      return false;
    }
  },

  openDeleteDialog: (task) => set({ pendingDelete: task, deleteError: "" }),

  closeDeleteDialog: () => set({ pendingDelete: null }),

  confirmDelete: async () => {
    const { pendingDelete } = get();
    if (!pendingDelete) return;

    try {
      await tasksApi.tasksDestroy({ id: pendingDelete.id });
    } catch (error) {
      set({ deleteError: await apiErrorMessage(error) });
      return;
    }

    set((state) => ({
      taskList: state.taskList
        ? {
            projectId: state.taskList.projectId,
            tasks: state.taskList.tasks.filter(
              (task) => task.id !== pendingDelete.id,
            ),
          }
        : state.taskList,
      pendingDelete: null,
    }));
  },

  updateTask: async (task, input) => {
    const updatedTask = await tasksApi.tasksPartialUpdate({
      id: task.id,
      patchedTaskUpdateRequest: {
        title: input.title,
        description: input.description,
        project: input.projectId,
      },
    });
    upsertTask(set, task, updatedTask);
    set({ editingTask: null });
  },
}));

/**
 * Reflect a Task update in the list without letting a late response clobber a
 * Project that was selected in the meantime.
 */
function upsertTask(
  set: (partial: Partial<TasksState> | ((state: TasksState) => Partial<TasksState>)) => void,
  previousTask: Task,
  updatedTask: Task,
) {
  set((state) => {
    const current = state.taskList;
    if (!current) return {};

    const taskWasVisible = current.tasks.some(
      (task) => task.id === previousTask.id,
    );
    const taskBelongsInList = updatedTask.project === current.projectId;
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
      (current.projectId === previousTask.project ||
        current.projectId === updatedTask.project)
    ) {
      return { loadError: null };
    }
    return {};
  });
}
