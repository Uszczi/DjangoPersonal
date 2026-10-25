import { create } from "zustand";

import { api } from "@personal/shared/api";
import type { FolderResponse } from "@personal/shared/generated/api";
import { createLoadGuard } from "@personal/shared/stores/loadGuard";

import { subtreeIds } from "@/whiteboard/folderTree";

/** The Notatnik's Folders, flat and alphabetically like the API lists them; `parentId` makes the tree. */
type FoldersState = {
  folders: FolderResponse[];
  isLoading: boolean;
  pageError: string;
  loadFolders: () => Promise<void>;
  /** Create a Folder at the top level, or inside `parentId`. */
  createFolder: (name: string, parentId?: number | null) => Promise<FolderResponse>;
  renameFolder: (id: number, name: string) => Promise<FolderResponse>;
  /** Move a Folder into another one, or to the top level with `null`. */
  moveFolder: (id: number, parentId: number | null) => Promise<FolderResponse>;
  /** Delete a Folder; resolves to the ids of it and every subfolder, which went with it. */
  deleteFolder: (id: number) => Promise<Set<number>>;
};

const loadGuard = createLoadGuard();

function byName(folders: FolderResponse[]) {
  return [...folders].sort((a, b) =>
    a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()),
  );
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  isLoading: true,
  pageError: "",

  loadFolders: async () => {
    const requestId = loadGuard.nextRequestId();
    try {
      const loaded = await api.foldersList();
      if (!loadGuard.isLatest(requestId)) return;
      set({ folders: loaded, pageError: "" });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          pageError:
            "Nie udało się wczytać folderów. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (loadGuard.isLatest(requestId)) set({ isLoading: false });
    }
  },

  createFolder: async (name, parentId = null) => {
    const created = await api.foldersCreate({ folderRequest: { name, parentId } });
    set((state) => ({ folders: byName([...state.folders, created]) }));
    return created;
  },

  renameFolder: async (id, name) => {
    const updated = await api.foldersPartialUpdate({
      id,
      patchedFolderRequest: { name },
    });
    set((state) => ({
      folders: byName(state.folders.map((item) => (item.id === id ? updated : item))),
    }));
    return updated;
  },

  moveFolder: async (id, parentId) => {
    const updated = await api.foldersPartialUpdate({
      id,
      patchedFolderRequest: { parentId },
    });
    set((state) => ({
      folders: state.folders.map((item) => (item.id === id ? updated : item)),
    }));
    return updated;
  },

  deleteFolder: async (id) => {
    await api.foldersDestroy({ id });
    const removed = subtreeIds(get().folders, id);
    set((state) => ({ folders: state.folders.filter((item) => !removed.has(item.id)) }));
    return removed;
  },
}));
