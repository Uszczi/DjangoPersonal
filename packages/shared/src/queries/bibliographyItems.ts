/**
 * The Bibliography's items as server state. The server lists them newest
 * first and narrows the list by status and kind, so each combination of
 * filters is its own cached list; a write keeps every cached list in step.
 */
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type {
  BibliographyItemResponse,
  PatchedBibliographyItemRequest,
  BibliographyItemRequest,
} from "../generated/api";
import type { ItemKind, ItemStatus } from "../bibliographyFormat";
import { bibliographyItemKeys } from "./keys";

/** Which items a list shows; a missing filter means all. */
export type BibliographyItemFilters = { status?: ItemStatus; kind?: ItemKind };

export function bibliographyItemsQuery(filters: BibliographyItemFilters = {}) {
  const { status, kind } = filters;
  return queryOptions({
    queryKey: bibliographyItemKeys.list({ status, kind }),
    queryFn: ({ signal }) => api.bibliographyItemsList({ status, kind }, { signal }),
  });
}

/** Switching filters keeps the previous list on screen until the new one arrives. */
export function useBibliographyItems(filters: BibliographyItemFilters = {}) {
  return useQuery({
    ...bibliographyItemsQuery(filters),
    placeholderData: keepPreviousData,
  });
}

function matches(
  item: BibliographyItemResponse,
  { status, kind }: BibliographyItemFilters,
) {
  return (!status || item.status === status) && (!kind || item.kind === kind);
}

export function useCreateBibliographyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bibliographyItemRequest: BibliographyItemRequest) =>
      api.bibliographyItemsCreate({ bibliographyItemRequest }),
    onSuccess: (created) => {
      const lists = queryClient
        .getQueryCache()
        .findAll({ queryKey: bibliographyItemKeys.all });
      for (const { queryKey } of lists) {
        const filters = (queryKey[1] ?? {}) as BibliographyItemFilters;
        if (!matches(created, filters)) continue;
        queryClient.setQueryData<BibliographyItemResponse[]>(
          queryKey,
          (list) => list && [created, ...list],
        );
      }
    },
  });
}

/**
 * Edit a BibliographyItem's fields; its kind is fixed at creation and its
 * status comes from its Attempts, so it stays in the same filtered lists.
 */
export function useUpdateBibliographyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: PatchedBibliographyItemRequest;
    }) =>
      api.bibliographyItemsPartialUpdate({
        id,
        patchedBibliographyItemRequest: changes,
      }),
    onSuccess: (updated) => {
      queryClient.setQueriesData<BibliographyItemResponse[]>(
        { queryKey: bibliographyItemKeys.all },
        (list) =>
          list?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}
