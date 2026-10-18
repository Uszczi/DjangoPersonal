import { create } from "zustand";

import { api } from "@/api";
import type { WhiteboardResponse } from "@/generated/api";
import type { BoardDocument } from "@/whiteboard/boardDocument";
import { parseBoard } from "@/whiteboard/boardDocument";
import { createLoadGuard } from "@/stores/loadGuard";
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
};

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
      const sorted = [...loaded].sort((a, b) => {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return tb - ta;
      });
      set({ whiteboards: sorted, pageError: "" });
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
}));

// Editor helpers
export type EditorState = {
  board: BoardDocument | null;
  saveState: SaveState;
  loadError: string;
  isLoading: boolean;
};

export function toBoardDocument(wb: WhiteboardResponse): BoardDocument {
  return parseBoard(wb.content);
}