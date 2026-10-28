/**
 * The Bibliografia's Pozycje as server state. The server lists them newest
 * first, so a created Pozycja goes to the top of the cached list.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { PatchedPozycjaRequest, PozycjaRequest } from "../generated/api";
import { pozycjaKeys } from "./keys";

export const pozycjeQuery = queryOptions({
  queryKey: pozycjaKeys.all,
  queryFn: ({ signal }) => api.pozycjeList({ signal }),
});

export function usePozycje() {
  return useQuery(pozycjeQuery);
}

export function useCreatePozycja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pozycjaRequest: PozycjaRequest) =>
      api.pozycjeCreate({ pozycjaRequest }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        pozycjeQuery.queryKey,
        (list) => list && [created, ...list],
      );
    },
  });
}

/** Edit a Pozycja's fields; its kind is fixed at creation. */
export function useUpdatePozycja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: PatchedPozycjaRequest;
    }) => api.pozycjePartialUpdate({ id, patchedPozycjaRequest: changes }),
    onSuccess: (updated) => {
      queryClient.setQueryData(pozycjeQuery.queryKey, (list) =>
        list?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}
