import { create } from "zustand";

import { api } from "@personal/shared/api";
import type { FolderResponse } from "@personal/shared/generated/api";
import { createLoadGuard } from "@personal/shared/stores/loadGuard";

/** The Notatnik's Folders, alphabetically like the API lists them. */
type FoldersState = {
  folders: FolderResponse[];
  isLoading: boolean;
  pageError: string;
  loadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<FolderResponse>;
  renameFolder: (id: number, name: string) => Promise<FolderResponse>;
  deleteFolder: (id: number) => Promise<void>;
};

const loadGuard = createLoadGuard();

function byName(folders: FolderResponse[]) {
  return [...folders].sort((a, b) =>
    a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()),
  );
}

export const useFoldersStore = create<FoldersState>((set) => ({
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

  createFolder: async (name) => {
    const created = await api.foldersCreate({ folderRequest: { name } });
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

  deleteFolder: async (id) => {
    await api.foldersDestroy({ id });
    set((state) => ({ folders: state.folders.filter((item) => item.id !== id) }));
  },
}));
