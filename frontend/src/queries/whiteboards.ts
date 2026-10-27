/**
 * The Notatnik's items (Tablice and Notatki) as server state, newest first.
 * One item's content is loaded and autosaved by the editor itself
 * (`useLoadedBoard`, `useAutosave`), not through this list.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "@personal/shared/api";
import type { WhiteboardResponse } from "@personal/shared/generated/api";

import { whiteboardKeys } from "./keys";

/** A Tablica (`whiteboard`) or a Notatka (`markdown`). */
export type ItemKind = "whiteboard" | "markdown";

function newestFirst(items: WhiteboardResponse[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export const whiteboardsQuery = queryOptions({
  queryKey: whiteboardKeys.all,
  queryFn: async ({ signal }) =>
    newestFirst(await api.whiteboardsList({ signal })),
});

export function useWhiteboards() {
  return useQuery(whiteboardsQuery);
}

/** Put the server's answer for one item into the list, where it was. */
export function replaceWhiteboard(
  queryClient: QueryClient,
  updated: WhiteboardResponse,
) {
  queryClient.setQueryData(whiteboardsQuery.queryKey, (list) =>
    list?.map((item) => (item.id === updated.id ? updated : item)),
  );
}

/** Create an untitled item, at the top level or in `folderId`. */
export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      folderId = null,
    }: {
      kind: ItemKind;
      folderId?: number | null;
    }) =>
      api.whiteboardsCreate({
        whiteboardRequest: { kind, name: "Bez tytułu", folderId },
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        whiteboardsQuery.queryKey,
        (list) => list && [created, ...list],
      );
    },
  });
}

export function useDeleteWhiteboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.whiteboardsDestroy({ id }),
    onSuccess: (_, id) => {
      queryClient.setQueryData(whiteboardsQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== id),
      );
    },
  });
}

/** Put an item in a Folder, or take it out of one with `null`. */
export function useMoveWhiteboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, folderId }: { id: number; folderId: number | null }) =>
      api.whiteboardsPartialUpdate({
        id,
        patchedWhiteboardRequest: { folderId },
      }),
    // A move counts as a change, so the item goes to the top of its new place.
    onSuccess: (updated) => {
      queryClient.setQueryData(
        whiteboardsQuery.queryKey,
        (list) =>
          list &&
          newestFirst(
            list.map((item) => (item.id === updated.id ? updated : item)),
          ),
      );
    },
  });
}
