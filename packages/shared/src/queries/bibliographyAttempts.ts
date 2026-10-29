/**
 * A bibliography item's Attempts as server state. The item's status is
 * derived from them on the server, so every Attempt write reloads the items too.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { AttemptRequest, PatchedAttemptRequest } from "../generated/api";
import { bibliographyItemKeys } from "./keys";

export const attemptsQuery = (itemId: number) =>
  queryOptions({
    queryKey: bibliographyItemKeys.attempts(itemId),
    queryFn: ({ signal }) =>
      api.bibliographyAttemptsList({ item: itemId }, { signal }),
  });

/** An item's Attempts, latest first; `null` waits for an item. */
export function useAttempts(itemId: number | null) {
  return useQuery({
    ...attemptsQuery(itemId ?? 0),
    enabled: itemId !== null,
  });
}

export const allAttemptsQuery = () =>
  queryOptions({
    queryKey: bibliographyItemKeys.allAttempts,
    queryFn: ({ signal }) => api.bibliographyAttemptsList({}, { signal }),
  });

/** Every Attempt of the user, latest first; loaded only while `enabled`. */
export function useAllAttempts(enabled = true) {
  return useQuery({ ...allAttemptsQuery(), enabled });
}

function afterWrite(queryClient: QueryClient, itemId: number) {
  // The server decides which Attempt is the latest (and so the status).
  void queryClient.invalidateQueries({
    queryKey: bibliographyItemKeys.attempts(itemId),
  });
  void queryClient.invalidateQueries({
    queryKey: bibliographyItemKeys.allAttempts,
  });
  void queryClient.invalidateQueries({ queryKey: bibliographyItemKeys.all });
}

/** Start an Attempt, or record one that has already ended. */
export function useCreateAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptRequest: AttemptRequest) =>
      api.bibliographyAttemptsCreate({ attemptRequest }),
    onSuccess: (created) => afterWrite(queryClient, created.itemId),
  });
}

/** Finish, abandon or re-date an Attempt. */
export function useUpdateAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: PatchedAttemptRequest;
    }) =>
      api.bibliographyAttemptsPartialUpdate({
        id,
        patchedAttemptRequest: changes,
      }),
    onSuccess: (updated) => afterWrite(queryClient, updated.itemId),
  });
}

/** Delete one Attempt of `itemId`, e.g. one recorded by mistake. */
export function useDeleteAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; itemId: number }) =>
      api.bibliographyAttemptsDestroy({ id }),
    onSuccess: (_, { itemId }) => afterWrite(queryClient, itemId),
  });
}
