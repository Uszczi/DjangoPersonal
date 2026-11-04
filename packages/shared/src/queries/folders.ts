/**
 * The Notatnik's Folders as server state: flat and alphabetical like the API
 * lists them; `parentId` makes the tree.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import { subtreeIds } from "../folderTree";
import type { FolderResponse, WhiteboardResponse } from "../generated/api";
import { compareIds } from "../ids";
import { folderKeys, whiteboardKeys } from "./keys";

/** The server's order: by name, character by character, so case matters. */
function byName(folders: FolderResponse[]) {
  return [...folders].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : compareIds(a.id, b.id),
  );
}

export const foldersQuery = queryOptions({
  queryKey: folderKeys.all,
  queryFn: ({ signal }) => api.foldersList({ signal }),
});

export function useFolders() {
  return useQuery(foldersQuery);
}

function replaceFolder(queryClient: QueryClient, updated: FolderResponse) {
  queryClient.setQueryData(
    foldersQuery.queryKey,
    (list) =>
      list &&
      byName(list.map((item) => (item.id === updated.id ? updated : item))),
  );
}

/** Create a Folder at the top level, or inside `parentId`. */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      parentId = null,
    }: {
      name: string;
      parentId?: string | null;
    }) => api.foldersCreate({ folderRequest: { name, parentId } }),
    onSuccess: (created) => {
      queryClient.setQueryData(
        foldersQuery.queryKey,
        (list) => list && byName([...list, created]),
      );
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.foldersPartialUpdate({ id, patchedFolderRequest: { name } }),
    onSuccess: (updated) => replaceFolder(queryClient, updated),
  });
}

/** Move a Folder into another one, or to the top level with `null`. */
export function useMoveFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      api.foldersPartialUpdate({ id, patchedFolderRequest: { parentId } }),
    onSuccess: (updated) => replaceFolder(queryClient, updated),
  });
}

/**
 * Delete a Folder. The server deletes every subfolder and every item in them
 * with it, so they leave the cached lists too.
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.foldersDestroy({ id }),
    onSuccess: (_, id) => {
      const removed = subtreeIds(
        queryClient.getQueryData(foldersQuery.queryKey) ?? [],
        id,
      );
      queryClient.setQueryData(foldersQuery.queryKey, (list) =>
        list?.filter((item) => !removed.has(item.id)),
      );
      queryClient.setQueryData<WhiteboardResponse[]>(
        whiteboardKeys.all,
        (list) =>
          list?.filter(
            (item) => item.folderId == null || !removed.has(item.folderId),
          ),
      );
    },
  });
}
