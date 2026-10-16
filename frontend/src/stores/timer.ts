import { create } from "zustand";

import { apiErrorMessage } from "@/apiErrorMessage";
import {
  Configuration,
  TasksApi,
  TimeEntriesApi,
  TimerApi,
  type Task,
  type TimeEntry,
  type TimerState,
} from "@/generated/api";

const timeEntriesApi = new TimeEntriesApi(new Configuration({ basePath: "" }));
const tasksApi = new TasksApi(new Configuration({ basePath: "" }));
const timerApi = new TimerApi(new Configuration({ basePath: "" }));

export type ManualEntryInput = {
  date: string;
  taskId: number;
  minutes: number;
};

export type EntryEditInput = {
  date: string;
  taskId: number;
  minutes: number;
};

type TimerStoreState = {
  isLoading: boolean;
  pageError: string;
  runningEntry: TimeEntry | null;
  serverOffset: number;
  entries: TimeEntry[];
  tasks: Task[];
  editingEntry: TimeEntry | null;
  actionError: string;
  loadData: () => Promise<void>;
  stopTimer: () => Promise<void>;
  discardTimer: () => Promise<void>;
  addManualEntry: (input: ManualEntryInput) => Promise<void>;
  updateEntry: (entry: TimeEntry, input: EntryEditInput) => Promise<void>;
  deleteEntry: (entry: TimeEntry) => Promise<void>;
  openEntryEditor: (entry: TimeEntry) => void;
  closeEntryEditor: () => void;
};

type TimerSet = (
  partial:
    | Partial<TimerStoreState>
    | ((state: TimerStoreState) => Partial<TimerStoreState>),
) => void;

function applyTimerState(set: TimerSet, timer: TimerState) {
  set({
    runningEntry: timer.entry ?? null,
    serverOffset: timer.serverNow.getTime() - Date.now(),
  });
}

let loadRequestId = 0;

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  isLoading: true,
  pageError: "",
  runningEntry: null,
  serverOffset: 0,
  entries: [],
  tasks: [],
  editingEntry: null,
  actionError: "",

  loadData: async () => {
    const requestId = ++loadRequestId;

    try {
      const [timer, loadedEntries, loadedTasks] = await Promise.all([
        timerApi.timerRetrieve(),
        timeEntriesApi.timeEntriesList({}),
        tasksApi.tasksList({ all: true }),
      ]);
      if (requestId !== loadRequestId) return;
      applyTimerState(set, timer);
      set({ entries: loadedEntries, tasks: loadedTasks });
    } catch {
      if (requestId === loadRequestId) {
        set({
          pageError:
            "Nie udało się wczytać danych czasu. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (requestId === loadRequestId) set({ isLoading: false });
    }
  },

  stopTimer: async () => {
    set({ actionError: "" });

    try {
      applyTimerState(set, await timerApi.timerStop());
      set({ entries: await timeEntriesApi.timeEntriesList({}) });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  discardTimer: async () => {
    const running = get().runningEntry;
    if (!running || running.end != null) return;

    set({ actionError: "" });

    try {
      await timeEntriesApi.timeEntriesDestroy({ id: running.id });
      set({
        runningEntry: null,
        entries: await timeEntriesApi.timeEntriesList({}),
      });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  addManualEntry: async (input) => {
    await timeEntriesApi.timeEntriesCreate({
      timeEntryCreateRequest: {
        task: input.taskId,
        date: new Date(`${input.date}T00:00:00`),
        durationMinutes: input.minutes,
      },
    });
    set({ entries: await timeEntriesApi.timeEntriesList({}) });
  },

  updateEntry: async (entry, input) => {
    await timeEntriesApi.timeEntriesPartialUpdate({
      id: entry.id,
      patchedTimeEntryRequest: {
        task: input.taskId,
        date: new Date(`${input.date}T00:00:00`),
        durationMinutes: input.minutes,
      },
    });
    set({
      editingEntry: null,
      entries: await timeEntriesApi.timeEntriesList({}),
    });
  },

  deleteEntry: async (entry) => {
    set({ actionError: "" });

    try {
      await timeEntriesApi.timeEntriesDestroy({ id: entry.id });
      set({ entries: await timeEntriesApi.timeEntriesList({}) });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  openEntryEditor: (entry) => set({ editingEntry: entry }),

  closeEntryEditor: () => set({ editingEntry: null }),
}));
