import { useEffect, useState } from "react";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useLoadGuard } from "@personal/shared/stores/loadGuard";
import type { BoardDocument } from "@/whiteboard/boardDocument";

/** A Notatnik item as the editor needs it: its name, kind and parsed content. */
export type LoadedBoard = {
  name: string;
  kind: string;
  board: BoardDocument;
  markdown: string;
};

export type BoardLoadState =
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error"; message: string }
  | { status: "loaded"; item: LoadedBoard };

/** Fetches one Notatnik item; a response for a board the user has since left is ignored. */
export function useLoadedBoard(boardId: string): BoardLoadState {
  // Tagged with the board it belongs to, so a result for the previous board is never shown.
  const [result, setResult] = useState<{
    boardId: string;
    state: BoardLoadState;
  } | null>(null);
  const loadGuard = useLoadGuard();

  useEffect(() => {
    const requestId = loadGuard.nextRequestId();
    const setState = (state: BoardLoadState) => setResult({ boardId, state });
    async function load() {
      try {
        const wb = await api.whiteboardsRetrieve({ id: Number(boardId) });
        if (!loadGuard.isLatest(requestId)) return;
        const { parseBoard } = await import("@/whiteboard/boardDocument");
        const markdown =
          (wb.content && (wb.content as { markdown?: string }).markdown) ?? "";
        setState({
          status: "loaded",
          item: {
            name: wb.name,
            kind: wb.kind ?? "whiteboard",
            board: parseBoard(wb.content),
            markdown,
          },
        });
      } catch (error) {
        if (!loadGuard.isLatest(requestId)) return;
        const status =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 404) {
          setState({ status: "notFound" });
          return;
        }
        const msg = await apiErrorMessage(error);
        setState({
          status: "error",
          message: msg || "Nie udało się wczytać tablicy.",
        });
      }
    }
    void load();
  }, [boardId, loadGuard]);

  return result?.boardId === boardId ? result.state : { status: "loading" };
}
