/**
 * Counters and their Counter entries as server state. A Counter's total,
 * count and place in the list come from its entries, so an entry write
 * reloads the Counters.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { CounterEntryResponse } from "../generated/api";
import { counterKeys } from "./keys";

export type CounterEntryInput = {
  value: number;
  occurredAt: Date;
  note: string;
};

/** Newest first, matching the server's order (occurred_at desc, then id desc). */
function newestFirst(entries: CounterEntryResponse[]): CounterEntryResponse[] {
  return [...entries].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id - a.id,
  );
}

export const countersQuery = queryOptions({
  queryKey: counterKeys.all,
  queryFn: ({ signal }) => api.countersList({ signal }),
});

export const counterEntriesQuery = (counterId: number) =>
  queryOptions({
    queryKey: counterKeys.entries(counterId),
    queryFn: ({ signal }) =>
      api.counterEntriesList({ counter: counterId }, { signal }),
  });

export function useCounters() {
  return useQuery(countersQuery);
}

/** A Counter's entries, newest first; `null` waits for a Counter. */
export function useCounterEntries(counterId: number | null) {
  return useQuery({
    ...counterEntriesQuery(counterId ?? 0),
    enabled: counterId !== null,
  });
}

function updateEntries(
  queryClient: QueryClient,
  counterId: number,
  update: (entries: CounterEntryResponse[]) => CounterEntryResponse[],
) {
  queryClient.setQueryData(
    counterEntriesQuery(counterId).queryKey,
    (entries) => entries && update(entries),
  );
}

export function useCreateCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.countersCreate({ counterRequest: { name } }),
    onSuccess: (created) => {
      // A counter with no entries yet sorts by its creation, so it goes first.
      queryClient.setQueryData(
        countersQuery.queryKey,
        (list) => list && [created, ...list],
      );
    },
  });
}

export function useRenameCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.countersPartialUpdate({ id, patchedCounterRequest: { name } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(countersQuery.queryKey, (list) =>
        list?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}

export function useDeleteCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.countersDestroy({ id }),
    onSuccess: (_, id) => {
      queryClient.setQueryData(countersQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== id),
      );
      queryClient.removeQueries({ queryKey: counterKeys.entries(id) });
    },
  });
}

/** Create (no `entry`) or update a Counter entry of `counterId`. */
export function useSaveCounterEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      counterId,
      input,
      entry,
    }: {
      counterId: number;
      input: CounterEntryInput;
      entry?: CounterEntryResponse | null;
    }) =>
      entry
        ? api.counterEntriesPartialUpdate({
            id: entry.id,
            patchedCounterEntryRequest: input,
          })
        : api.counterEntriesCreate({
            counterEntryRequest: { ...input, counter: counterId },
          }),
    onSuccess: (saved, { counterId }) => {
      updateEntries(queryClient, counterId, (entries) =>
        newestFirst([...entries.filter((item) => item.id !== saved.id), saved]),
      );
      void queryClient.invalidateQueries({ queryKey: counterKeys.all });
    },
  });
}

export function useDeleteCounterEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: CounterEntryResponse) =>
      api.counterEntriesDestroy({ id: entry.id }),
    onSuccess: (_, entry) => {
      updateEntries(queryClient, entry.counterId, (entries) =>
        entries.filter((item) => item.id !== entry.id),
      );
      void queryClient.invalidateQueries({ queryKey: counterKeys.all });
    },
  });
}
