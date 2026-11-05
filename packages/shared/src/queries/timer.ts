/**
 * The Running timer and the Time entries as server state. Every write that
 * changes the entries reloads them: the server decides how a stopped timer or
 * a manual entry is recorded, so the client does not guess.
 */
import {
  keepPreviousData,
  onlineManager,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "../api";
import { newId } from "../ids";
import { useDebouncedValue } from "../useDebouncedValue";
import type {
  TimeEntryResponse,
  TimerResponse,
  TimerStartRequest,
} from "../generated/api";
import { timerKeys, timerWriteKeys } from "./keys";
import {
  idempotent,
  outboxOptions,
  reportRefusal,
  useOutboxBacklog,
  useOutboxWrite,
  type OutboxVariables,
} from "./outbox";

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

/**
 * Measured on arrival, so the offset is not skewed by when the cache is read.
 * A Stop answers with the entry it ended, which is no longer running.
 */
function toTimerState(timer: TimerResponse): TimerState {
  const entry = timer.entry ?? null;
  return {
    runningEntry: entry && entry.end == null ? entry : null,
    serverOffset: timer.serverNow.getTime() - Date.now(),
  };
}

export const timerQuery = queryOptions({
  queryKey: timerKeys.timer,
  queryFn: async ({ signal, client }): Promise<TimerState> => {
    const fresh = toTimerState(await api.timerRetrieve({ signal }));
    // A timer write still on its way is already on screen; this answer was
    // made before it and would undo it until the write's own answer arrives.
    const cached = client.getQueryData<TimerState>(timerKeys.timer);
    return cached && unansweredTimerWrites(client) > 0 ? cached : fresh;
  },
});

export const timeEntriesQuery = queryOptions({
  queryKey: timerKeys.entries,
  queryFn: ({ signal }) => api.timeEntriesList({}, { signal }),
});

/** Past entries' titles matching `search`, prefix matches and the most recently used first. */
export function timeEntryTitlesQuery(search: string) {
  return queryOptions({
    queryKey: timerKeys.titles(search),
    queryFn: ({ signal }) => api.timeEntriesTitles({ search }, { signal }),
  });
}

/**
 * Titles to suggest while the user types one: asked of the server once the
 * typing pauses, keeping the last answer on screen meanwhile.
 */
export function useTimeEntryTitles(search: string) {
  const debounced = useDebouncedValue(search.trim(), 250);
  return useQuery({
    ...timeEntryTitlesQuery(debounced),
    placeholderData: keepPreviousData,
  });
}

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
 * Offline, a limited timer whose time is up is stopped in the cache instead,
 * as the server will record it.
 */
export function useRefreshTimer() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    if (!onlineManager.isOnline()) {
      settleExpiredLocally(queryClient);
      return {
        timer: queryClient.getQueryData(timerQuery.queryKey) ?? {
          runningEntry: null,
          serverOffset: 0,
        },
        entries: queryClient.getQueryData(timeEntriesQuery.queryKey) ?? [],
      };
    }
    const timer = await queryClient.fetchQuery({ ...timerQuery, staleTime: 0 });
    const entries = await queryClient.fetchQuery({
      ...timeEntriesQuery,
      staleTime: 0,
    });
    return { timer, entries };
  }, [queryClient]);
}

/*
 * The timer's writes go through the Outbox (`outbox.ts`): Start, Stop and
 * Discard work offline. Each carries the moment the user pressed the button
 * (on the server's clock, as last measured) and names its entry by id, the
 * new entry's id being made here, so the server records what the user meant
 * however late the write arrives.
 */

/** The timer's writes are sent one at a time, in the order they were made. */
export const TIMER_SCOPE = "timer";

type StartWrite = OutboxVariables & {
  id: string;
  at: Date;
  task?: string | null;
  title?: string;
  durationMinutes?: number | null;
};

type StopWrite = OutboxVariables & {
  /** The running entry when Stop was pressed; omitted stops whatever runs. */
  entry?: string;
  at: Date;
};

type DiscardWrite = OutboxVariables & { entry: string };

/** What a Start found when it was made. */
type StartContext = { endedPrevious: boolean };

/** What a Start form or a Task row hands in. */
export type TimerStartInput = Pick<
  TimerStartRequest,
  "task" | "title" | "durationMinutes"
>;

/** The server's clock now, by the offset this device last measured. */
function serverNow(queryClient: QueryClient): Date {
  const offset =
    queryClient.getQueryData(timerQuery.queryKey)?.serverOffset ?? 0;
  return new Date(Date.now() + offset);
}

function cachedRunningEntry(queryClient: QueryClient) {
  return queryClient.getQueryData(timerQuery.queryKey)?.runningEntry ?? null;
}

function setRunningEntry(
  queryClient: QueryClient,
  runningEntry: TimeEntryResponse | null,
) {
  queryClient.setQueryData(timerQuery.queryKey, (state) => ({
    runningEntry,
    serverOffset: state?.serverOffset ?? 0,
  }));
}

/** The entry as the server records it when it ends at `at` (or its limit, if sooner). */
function endedAt(entry: TimeEntryResponse, at: Date): TimeEntryResponse {
  const end = entry.plannedEnd && entry.plannedEnd < at ? entry.plannedEnd : at;
  return { ...entry, end };
}

/** Put an entry at the top of the cached list, replacing its earlier copy. */
function putEntry(queryClient: QueryClient, entry: TimeEntryResponse) {
  queryClient.setQueryData(
    timeEntriesQuery.queryKey,
    (entries) =>
      entries && [entry, ...entries.filter((item) => item.id !== entry.id)],
  );
}

function removeEntry(queryClient: QueryClient, entryId: string) {
  queryClient.setQueryData(
    timeEntriesQuery.queryKey,
    (entries) => entries && entries.filter((item) => item.id !== entryId),
  );
}

/** Stop a limited timer whose time is up in the cache, as the server will. */
function settleExpiredLocally(queryClient: QueryClient) {
  const running = cachedRunningEntry(queryClient);
  if (!running?.plannedEnd || running.plannedEnd > serverNow(queryClient))
    return;
  putEntry(queryClient, endedAt(running, running.plannedEnd));
  setRunningEntry(queryClient, null);
}

/** How many timer writes have not been answered yet, counting one in progress. */
function unansweredTimerWrites(queryClient: QueryClient) {
  return queryClient.isMutating({
    predicate: (mutation) => mutation.options.scope?.id === TIMER_SCOPE,
  });
}

/**
 * Take the server's answer, unless more timer writes are queued behind this
 * one: the cache already shows them, and the last one's answer settles it.
 */
function acceptAnswer(
  queryClient: QueryClient,
  timer: TimerResponse,
  entriesChanged: boolean,
) {
  if (unansweredTimerWrites(queryClient) > 1) return;
  setTimer(queryClient, timer);
  if (entriesChanged) return reloadEntries(queryClient);
}

/** A refused write: say why, and replace what the cache guessed with the server's state. */
async function undoRefused(
  queryClient: QueryClient,
  error: unknown,
  write: OutboxVariables,
) {
  await reportRefusal(error, write);
  if (unansweredTimerWrites(queryClient) <= 1) {
    try {
      setTimer(queryClient, await api.timerRetrieve());
    } catch {
      void queryClient.invalidateQueries({ queryKey: timerKeys.timer });
    }
  }
  void reloadEntries(queryClient);
}

/** Register the timer's writes on `queryClient`; `createQueryClient` does it once. */
export function registerTimerWrites(queryClient: QueryClient) {
  queryClient.setMutationDefaults(timerWriteKeys.start, {
    ...outboxOptions(TIMER_SCOPE),
    mutationFn: ({ idempotencyKey, ...request }: StartWrite) =>
      api.timerStart(
        { timerStartRequest: request },
        idempotent({ idempotencyKey }),
      ),
    onMutate: async (write: StartWrite): Promise<StartContext> => {
      await queryClient.cancelQueries({ queryKey: timerKeys.timer });
      const previous = cachedRunningEntry(queryClient);
      if (previous) putEntry(queryClient, endedAt(previous, write.at));
      const limit = write.durationMinutes;
      setRunningEntry(queryClient, {
        id: write.id,
        taskId: write.task ?? null,
        title: write.title ?? "",
        start: write.at,
        end: null,
        plannedEnd: limit
          ? new Date(write.at.getTime() + limit * 60_000)
          : null,
      });
      return { endedPrevious: previous !== null };
    },
    onSuccess: (timer: TimerResponse, _write, context?: StartContext) =>
      acceptAnswer(queryClient, timer, context?.endedPrevious ?? false),
    onError: (error, write) => undoRefused(queryClient, error, write),
  });

  queryClient.setMutationDefaults(timerWriteKeys.stop, {
    ...outboxOptions(TIMER_SCOPE),
    mutationFn: ({ idempotencyKey, ...request }: StopWrite) =>
      api.timerStop(
        { timerStopRequest: request },
        idempotent({ idempotencyKey }),
      ),
    onMutate: async (write: StopWrite) => {
      await queryClient.cancelQueries({ queryKey: timerKeys.timer });
      const running = cachedRunningEntry(queryClient);
      if (running) putEntry(queryClient, endedAt(running, write.at));
      setRunningEntry(queryClient, null);
    },
    onSuccess: (timer: TimerResponse) => acceptAnswer(queryClient, timer, true),
    onError: (error, write) => undoRefused(queryClient, error, write),
  });

  queryClient.setMutationDefaults(timerWriteKeys.discard, {
    ...outboxOptions(TIMER_SCOPE),
    mutationFn: ({ idempotencyKey, entry }: DiscardWrite) =>
      api.timeEntriesDestroy({ id: entry }, idempotent({ idempotencyKey })),
    onMutate: async (write: DiscardWrite) => {
      await queryClient.cancelQueries({ queryKey: timerKeys.timer });
      removeEntry(queryClient, write.entry);
      setRunningEntry(queryClient, null);
    },
    onSuccess: () => {
      if (unansweredTimerWrites(queryClient) <= 1)
        return reloadEntries(queryClient);
    },
    onError: (error, write) => undoRefused(queryClient, error, write),
  });
}

/**
 * Start a timer: on a Task (`task`), or under a title, optionally limited to
 * `durationMinutes` (the server then stops it by itself). Works offline.
 */
export function useStartTimer() {
  return useOutboxWrite(
    timerWriteKeys.start,
    (queryClient, input: TimerStartInput): StartWrite => ({
      ...input,
      id: newId(),
      at: serverNow(queryClient),
      idempotencyKey: newId(),
    }),
  );
}

/** Stop the running timer now. Works offline. */
export function useStopTimer() {
  return useOutboxWrite(
    timerWriteKeys.stop,
    (queryClient, _input: void): StopWrite => ({
      entry: cachedRunningEntry(queryClient)?.id,
      at: serverNow(queryClient),
      idempotencyKey: newId(),
    }),
  );
}

/** Throw the running entry away instead of recording it. Works offline. */
export function useDiscardTimer() {
  return useOutboxWrite(
    timerWriteKeys.discard,
    (_queryClient, running: TimeEntryResponse): DiscardWrite => ({
      entry: running.id,
      idempotencyKey: newId(),
    }),
  );
}

/** How many of the timer's writes wait to be sent (offline, or unanswered). */
export function useTimerBacklog() {
  return useOutboxBacklog(TIMER_SCOPE);
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
