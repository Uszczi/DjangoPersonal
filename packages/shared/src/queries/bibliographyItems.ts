/**
 * The Bibliography's items as server state. The server lists them newest
 * first, so a created item goes to the top of the cached list.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { PatchedBibliographyItemRequest, BibliographyItemRequest } from "../generated/api";
import { bibliographyItemKeys } from "./keys";

export const bibliographyItemsQuery = queryOptions({
  queryKey: bibliographyItemKeys.all,
  queryFn: ({ signal }) => api.bibliographyItemsList({ signal }),
});

export function useBibliographyItems() {
  return useQuery(bibliographyItemsQuery);
}

export function useCreateBibliographyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bibliographyItemRequest: BibliographyItemRequest) =>
      api.bibliographyItemsCreate({ bibliographyItemRequest }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        bibliographyItemsQuery.queryKey,
        (list) => list && [created, ...list],
      );
    },
  });
}

/** Edit a BibliographyItem's fields; its kind is fixed at creation. */
export function useUpdateBibliographyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: PatchedBibliographyItemRequest;
    }) => api.bibliographyItemsPartialUpdate({ id, patchedBibliographyItemRequest: changes }),
    onSuccess: (updated) => {
      queryClient.setQueryData(bibliographyItemsQuery.queryKey, (list) =>
        list?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}
