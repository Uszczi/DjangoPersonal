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
import type {
  AttemptRequest,
  AttemptResponse,
  PatchedAttemptRequest,
} from "../generated/api";
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

function afterWrite(queryClient: QueryClient, saved: AttemptResponse) {
  // The server decides which Attempt is the latest (and so the status).
  void queryClient.invalidateQueries({
    queryKey: bibliographyItemKeys.attempts(saved.itemId),
  });
  void queryClient.invalidateQueries({ queryKey: bibliographyItemKeys.all });
}

/** Start an Attempt, or record one that has already ended. */
export function useCreateAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptRequest: AttemptRequest) =>
      api.bibliographyAttemptsCreate({ attemptRequest }),
    onSuccess: (created) => afterWrite(queryClient, created),
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
    onSuccess: (updated) => afterWrite(queryClient, updated),
  });
}
