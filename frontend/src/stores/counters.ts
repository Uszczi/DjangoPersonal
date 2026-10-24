import { create } from "zustand";

import { api } from "@/api";
import {
  parseDate,
  type CounterEntryResponse,
  type CounterResponse,
} from "@/generated/api";
import { createLoadGuard } from "@/stores/loadGuard";

export type CounterEntryInput = {
  value: number;
  /** `yyyy-mm-dd`, as the date input carries it. */
  date: string;
  note: string;
};

/** Newest first, matching the server's order (date desc, then id desc). */
function newestFirst(entries: CounterEntryResponse[]): CounterEntryResponse[] {
  return [...entries].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id,
  );
}

export type CounterEntryList = {
  counterId: number;
  entries: CounterEntryResponse[];
} | null;

type CountersState = {
  counters: CounterResponse[];
  isLoading: boolean;
  pageError: string;
  entryList: CounterEntryList;
  entriesError: string;
  loadCounters: () => Promise<void>;
  createCounter: (name: string) => Promise<CounterResponse>;
  renameCounter: (id: number, name: string) => Promise<CounterResponse>;
  deleteCounter: (id: number) => Promise<void>;
  loadEntries: (counterId: number) => Promise<void>;
  saveEntry: (
    counterId: number,
    input: CounterEntryInput,
    entry?: CounterEntryResponse | null,
  ) => Promise<CounterEntryResponse>;
  deleteEntry: (entry: CounterEntryResponse) => Promise<void>;
};

const countersGuard = createLoadGuard();
const entriesGuard = createLoadGuard();

export const useCountersStore = create<CountersState>((set, get) => {
  /** The total and count are computed from the entries: refetch the counter after a change. */
  async function refreshCounter(id: number) {
    try {
      const fresh = await api.countersRetrieve({ id });
      set((state) => ({
        counters: state.counters.map((item) => (item.id === id ? fresh : item)),
      }));
    } catch {
      // The list keeps its old numbers; the next load fixes them.
    }
  }

  function replaceEntries(
    counterId: number,
    change: (entries: CounterEntryResponse[]) => CounterEntryResponse[],
  ) {
    const current = get().entryList;
    if (!current || current.counterId !== counterId) return;
    set({ entryList: { counterId, entries: change(current.entries) } });
  }

  return {
    counters: [],
    isLoading: true,
    pageError: "",
    entryList: null,
    entriesError: "",

    loadCounters: async () => {
      const requestId = countersGuard.nextRequestId();
      try {
        const loaded = await api.countersList();
        if (!countersGuard.isLatest(requestId)) return;
        set({ counters: loaded, pageError: "" });
      } catch {
        if (countersGuard.isLatest(requestId)) {
          set({
            pageError:
              "Nie udało się wczytać liczników. Odśwież stronę, aby spróbować ponownie.",
          });
        }
      } finally {
        if (countersGuard.isLatest(requestId)) set({ isLoading: false });
      }
    },

    createCounter: async (name) => {
      const created = await api.countersCreate({ counterRequest: { name } });
      set((state) => ({ counters: [...state.counters, created] }));
      return created;
    },

    renameCounter: async (id, name) => {
      const updated = await api.countersPartialUpdate({
        id,
        patchedCounterRequest: { name },
      });
      set((state) => ({
        counters: state.counters.map((item) => (item.id === id ? updated : item)),
      }));
      return updated;
    },

    deleteCounter: async (id) => {
      await api.countersDestroy({ id });
      set((state) => ({
        counters: state.counters.filter((item) => item.id !== id),
        entryList: state.entryList?.counterId === id ? null : state.entryList,
      }));
    },

    loadEntries: async (counterId) => {
      const requestId = entriesGuard.nextRequestId();
      try {
        const loaded = await api.counterEntriesList({ counter: counterId });
        if (!entriesGuard.isLatest(requestId)) return;
        set({ entryList: { counterId, entries: loaded }, entriesError: "" });
      } catch {
        if (entriesGuard.isLatest(requestId)) {
          set({ entriesError: "Nie udało się wczytać wpisów. Spróbuj ponownie." });
        }
      }
    },

    saveEntry: async (counterId, input, entry) => {
      const saved = entry
        ? await api.counterEntriesPartialUpdate({
            id: entry.id,
            patchedCounterEntryRequest: { ...input, date: parseDate(input.date) },
          })
        : await api.counterEntriesCreate({
            counterEntryRequest: {
              ...input,
              counter: counterId,
              date: parseDate(input.date),
            },
          });
      replaceEntries(counterId, (entries) =>
        newestFirst([...entries.filter((item) => item.id !== saved.id), saved]),
      );
      void refreshCounter(counterId);
      return saved;
    },

    deleteEntry: async (entry) => {
      await api.counterEntriesDestroy({ id: entry.id });
      replaceEntries(entry.counterId, (entries) =>
        entries.filter((item) => item.id !== entry.id),
      );
      void refreshCounter(entry.counterId);
    },
  };
});
