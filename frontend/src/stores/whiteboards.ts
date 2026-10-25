import { create } from "zustand";

import { api } from "@personal/shared/api";
import type { WhiteboardResponse } from "@personal/shared/generated/api";
import type { BoardDocument } from "@/whiteboard/boardDocument";
import { parseBoard } from "@/whiteboard/boardDocument";
import { createLoadGuard } from "@personal/shared/stores/loadGuard";
import type { SaveState } from "@/whiteboard/useAutosave";

export type { SaveState };

type WhiteboardsState = {
  whiteboards: WhiteboardResponse[];
  isLoading: boolean;
  pageError: string;
  loadWhiteboards: () => Promise<void>;
  createWhiteboard: () => Promise<WhiteboardResponse | null>;
  renameWhiteboard: (id: number, name: string) => Promise<void>;
  deleteWhiteboard: (id: number) => Promise<void>;
  /** Put an item in a Folder, or take it out of one with `null`. */
  moveWhiteboard: (id: number, folderId: number | null) => Promise<void>;
  /** Drop the items of deleted Folders, which the backend deleted with them. */
  dropFolderItems: (folderIds: Set<number>) => void;
};

function newestFirst(items: WhiteboardResponse[]) {
  return [...items].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

const loadGuard = createLoadGuard();

export const useWhiteboardsStore = create<WhiteboardsState>((set) => ({
  whiteboards: [],
  isLoading: true,
  pageError: "",

  loadWhiteboards: async () => {
    const requestId = loadGuard.nextRequestId();
    try {
      const loaded = await api.whiteboardsList();
      if (!loadGuard.isLatest(requestId)) return;
      set({ whiteboards: newestFirst(loaded), pageError: "" });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          pageError:
            "Nie udało się wczytać tablic. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (loadGuard.isLatest(requestId)) set({ isLoading: false });
    }
  },

  createWhiteboard: async () => {
    try {
      const created = await api.whiteboardsCreate({
        whiteboardRequest: { name: "Bez tytułu" },
      });
      set((state) => ({ whiteboards: [created, ...state.whiteboards] }));
      return created;
    } catch {
      return null;
    }
  },

  renameWhiteboard: async (id, name) => {
    const updated = await api.whiteboardsPartialUpdate({
      id,
      patchedWhiteboardRequest: { name },
    });
    set((state) => ({
      whiteboards: state.whiteboards.map((item) =>
        item.id === id ? updated : item,
      ),
    }));
  },

  deleteWhiteboard: async (id) => {
    await api.whiteboardsDestroy({ id });
    set((state) => ({
      whiteboards: state.whiteboards.filter((item) => item.id !== id),
    }));
  },

  moveWhiteboard: async (id, folderId) => {
    const updated = await api.whiteboardsPartialUpdate({
      id,
      patchedWhiteboardRequest: { folderId },
    });
    // A move counts as a change, so the item goes to the top of its new place.
    set((state) => ({
      whiteboards: newestFirst(state.whiteboards.map((item) => (item.id === id ? updated : item))),
    }));
  },

  dropFolderItems: (folderIds) => {
    set((state) => ({
      whiteboards: state.whiteboards.filter(
        (item) => item.folderId == null || !folderIds.has(item.folderId),
      ),
    }));
  },
}));

export type EditorState = {
  board: BoardDocument | null;
  saveState: SaveState;
  loadError: string;
  isLoading: boolean;
};

export function toBoardDocument(wb: WhiteboardResponse): BoardDocument {
  return parseBoard(wb.content);
}