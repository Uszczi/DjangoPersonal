/**
 * The Running timer and the Time entries as server state. Every write that
 * changes the entries reloads them: the server decides how a stopped timer or
 * a manual entry is recorded, so the client does not guess.
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
import type {
  TimeEntryResponse,
  TimerResponse,
  TimerStartRequest,
} from "../generated/api";
import { timerKeys } from "./keys";

/** What the manual entry and entry edit forms collect. */
export type EntryInput = {
  date: string;
  title: string;
  minutes: number;
};
export type ManualEntryInput = EntryInput;
export type EntryEditInput = EntryInput;

export type TimerState = {
  /** The running entry, or `null` when no timer runs. */
  runningEntry: TimeEntryResponse | null;
  /** Server clock minus this device's, in ms, measured when the answer arrived. */
  serverOffset: number;
};

/** Measured on arrival, so the offset is not skewed by when the cache is read. */
function toTimerState(timer: TimerResponse): TimerState {
  return {
    runningEntry: timer.entry ?? null,
    serverOffset: timer.serverNow.getTime() - Date.now(),
  };
}

export const timerQuery = queryOptions({
  queryKey: timerKeys.timer,
  queryFn: async ({ signal }) =>
    toTimerState(await api.timerRetrieve({ signal })),
});

export const timeEntriesQuery = queryOptions({
  queryKey: timerKeys.entries,
  queryFn: ({ signal }) => api.timeEntriesList({}, { signal }),
});

export function useTimer() {
  return useQuery(timerQuery);
}

export function useTimeEntries() {
  return useQuery(timeEntriesQuery);
}

function setTimer(queryClient: QueryClient, timer: TimerResponse) {
  queryClient.setQueryData(timerQuery.queryKey, toTimerState(timer));
}

/** Resolves once the entries are reloaded, so a caller awaiting the write sees them. */
function reloadEntries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: timerKeys.entries });
}

/**
 * Re-read the timer, then the entries, bypassing the cache. The timer goes
 * first: reading it is what stops an expired limited timer on the server.
 */
export function useRefreshTimer() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const timer = await queryClient.fetchQuery({ ...timerQuery, staleTime: 0 });
    const entries = await queryClient.fetchQuery({
      ...timeEntriesQuery,
      staleTime: 0,
    });
    return { timer, entries };
  }, [queryClient]);
}

/**
 * Start a timer: on a Task (`task`), or under a title, optionally limited to
 * `durationMinutes` (the server then stops it by itself).
 */
export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TimerStartRequest) =>
      api.timerStart({ timerStartRequest: request }),
    onSuccess: (timer) => setTimer(queryClient, timer),
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.timerStop(),
    onSuccess: (timer) => {
      setTimer(queryClient, timer);
      return reloadEntries(queryClient);
    },
  });
}

/** Throw the running entry away instead of recording it. */
export function useDiscardTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (running: TimeEntryResponse) =>
      api.timeEntriesDestroy({ id: running.id }),
    onSuccess: () => {
      queryClient.setQueryData(
        timerQuery.queryKey,
        (state) => state && { ...state, runningEntry: null },
      );
      return reloadEntries(queryClient);
    },
  });
}

/** The entry fields as the API takes them: a day and a length. */
function toEntryRequest(input: EntryInput) {
  return {
    title: input.title,
    date: new Date(`${input.date}T00:00:00`),
    durationMinutes: input.minutes,
  };
}

export function useAddManualEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualEntryInput) =>
      api.timeEntriesCreate({ timeEntryCreateRequest: toEntryRequest(input) }),
    onSuccess: () => reloadEntries(queryClient),
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entry,
      input,
    }: {
      entry: TimeEntryResponse;
      input: EntryEditInput;
    }) =>
      api.timeEntriesPartialUpdate({
        id: entry.id,
        patchedTimeEntryRequest: toEntryRequest(input),
      }),
    onSuccess: () => reloadEntries(queryClient),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: TimeEntryResponse) =>
      api.timeEntriesDestroy({ id: entry.id }),
    onSuccess: () => reloadEntries(queryClient),
  });
}
