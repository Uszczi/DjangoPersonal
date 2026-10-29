/**
 * The Bibliography's items as server state. The server lists them newest
 * first and narrows the list by status and kind, so each combination of
 * filters is its own cached list, and one item is cached on its own for its
 * page; a write keeps every cached list and the item in step.
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
  AttemptResponse,
  BibliographyItemResponse,
  PatchedBibliographyItemRequest,
  BibliographyItemRequest,
} from "../generated/api";
import {
  bibliographyItemKeys,
  bibliographyListFilters,
  type BibliographyItemFilters,
} from "./keys";

export type { BibliographyItemFilters } from "./keys";

export function bibliographyItemsQuery(filters: BibliographyItemFilters = {}) {
  const { status, kind } = filters;
  return queryOptions({
    queryKey: bibliographyItemKeys.list({ status, kind }),
    queryFn: ({ signal }) =>
      api.bibliographyItemsList({ status, kind }, { signal }),
  });
}

/** Switching filters keeps the previous list on screen until the new one arrives. */
export function useBibliographyItems(filters: BibliographyItemFilters = {}) {
  return useQuery({
    ...bibliographyItemsQuery(filters),
    placeholderData: keepPreviousData,
  });
}

export const bibliographyItemQuery = (itemId: number) =>
  queryOptions({
    queryKey: bibliographyItemKeys.detail(itemId),
    queryFn: ({ signal }) =>
      api.bibliographyItemsRetrieve({ id: itemId }, { signal }),
  });

/**
 * One item with its status; `null` waits for an id. A cached list's copy is
 * shown while it loads, so opening an item from the list is instant.
 */
export function useBibliographyItem(itemId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    ...bibliographyItemQuery(itemId ?? 0),
    enabled: itemId !== null,
    placeholderData: () => {
      for (const [, list] of queryClient.getQueriesData<
        BibliographyItemResponse[]
      >({
        queryKey: bibliographyItemKeys.lists,
      })) {
        const cached = list?.find((item) => item.id === itemId);
        if (cached) return cached;
      }
      return undefined;
    },
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
      queryClient.setQueryData(
        bibliographyItemKeys.detail(created.id),
        created,
      );
      const lists = queryClient
        .getQueryCache()
        .findAll({ queryKey: bibliographyItemKeys.lists });
      for (const { queryKey } of lists) {
        if (!matches(created, bibliographyListFilters(queryKey))) continue;
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
      queryClient.setQueryData(
        bibliographyItemKeys.detail(updated.id),
        updated,
      );
      queryClient.setQueriesData<BibliographyItemResponse[]>(
        { queryKey: bibliographyItemKeys.lists },
        (list) =>
          list?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });
}

/** Delete a BibliographyItem; its Attempts go with it on the server. */
export function useDeleteBibliographyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.bibliographyItemsDestroy({ id }),
    onSuccess: (_, id) => {
      queryClient.setQueriesData<BibliographyItemResponse[]>(
        { queryKey: bibliographyItemKeys.lists },
        (list) => list?.filter((item) => item.id !== id),
      );
      queryClient.removeQueries({ queryKey: bibliographyItemKeys.detail(id) });
      queryClient.removeQueries({
        queryKey: bibliographyItemKeys.attempts(id),
      });
      queryClient.setQueryData<AttemptResponse[]>(
        bibliographyItemKeys.allAttempts,
        (attempts) => attempts?.filter((attempt) => attempt.itemId !== id),
      );
    },
  });
}
