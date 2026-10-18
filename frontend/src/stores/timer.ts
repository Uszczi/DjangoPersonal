import { create } from "zustand";

import { apiErrorMessage } from "@/apiErrorMessage";
import { api } from "@/api";
import { type TaskResponse, type TimeEntryResponse, type TimerResponse } from "@/generated/api";

export type ManualEntryInput = {
  date: string;
  title: string;
  minutes: number;
};

export type EntryEditInput = {
  date: string;
  title: string;
  minutes: number;
};

type TimerStoreState = {
  isLoading: boolean;
  pageError: string;
  runningEntry: TimeEntryResponse | null;
  serverOffset: number;
  entries: TimeEntryResponse[];
  tasks: TaskResponse[];
  editingEntry: TimeEntryResponse | null;
  actionError: string;
  loadData: () => Promise<void>;
  startTimer: (title: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  discardTimer: () => Promise<void>;
  addManualEntry: (input: ManualEntryInput) => Promise<void>;
  updateEntry: (entry: TimeEntryResponse, input: EntryEditInput) => Promise<void>;
  deleteEntry: (entry: TimeEntryResponse) => Promise<void>;
  openEntryEditor: (entry: TimeEntryResponse) => void;
  closeEntryEditor: () => void;
};

type TimerSet = (
  partial:
    | Partial<TimerStoreState>
    | ((state: TimerStoreState) => Partial<TimerStoreState>),
) => void;

function applyTimerState(set: TimerSet, timer: TimerResponse) {
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
        api.timerRetrieve(),
        api.timeEntriesList({}),
        api.tasksList({ all: true }),
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

  startTimer: async (title) => {
    applyTimerState(
      set,
      await api.timerStart({ timerStartRequest: { title } }),
    );
  },

  stopTimer: async () => {
    set({ actionError: "" });

    try {
      applyTimerState(set, await api.timerStop());
      set({ entries: await api.timeEntriesList({}) });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  discardTimer: async () => {
    const running = get().runningEntry;
    if (!running || running.end != null) return;

    set({ actionError: "" });

    try {
      await api.timeEntriesDestroy({ id: running.id });
      set({
        runningEntry: null,
        entries: await api.timeEntriesList({}),
      });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  addManualEntry: async (input) => {
    await api.timeEntriesCreate({
      timeEntryCreateRequest: {
        title: input.title,
        date: new Date(`${input.date}T00:00:00`),
        durationMinutes: input.minutes,
      },
    });
    set({ entries: await api.timeEntriesList({}) });
  },

  updateEntry: async (entry, input) => {
    await api.timeEntriesPartialUpdate({
      id: entry.id,
      patchedTimeEntryRequest: {
        title: input.title,
        date: new Date(`${input.date}T00:00:00`),
        durationMinutes: input.minutes,
      },
    });
    set({
      editingEntry: null,
      entries: await api.timeEntriesList({}),
    });
  },

  deleteEntry: async (entry) => {
    set({ actionError: "" });

    try {
      await api.timeEntriesDestroy({ id: entry.id });
      set({ entries: await api.timeEntriesList({}) });
    } catch (error) {
      set({ actionError: await apiErrorMessage(error) });
    }
  },

  openEntryEditor: (entry) => set({ editingEntry: entry }),

  closeEntryEditor: () => set({ editingEntry: null }),
}));
