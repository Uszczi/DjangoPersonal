import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";

import { ErrorMessage, LoadingStatus } from "@/design-system";
import { BoardEditor } from "@/components/whiteboard/BoardEditor";
import { NotFoundPage } from "@/components/NotFoundPage";
import { useLoadedBoard } from "@/whiteboard/useLoadedBoard";

export const Route = createFileRoute("/whiteboard/$boardId")({
  component: WhiteboardEditorPage,
  // `q`: a Notatnik search to start the open Notatka's own search with.
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q !== "" ? { q: search.q } : {},
});

function WhiteboardEditorPage() {
  const { boardId } = useParams({ from: "/whiteboard/$boardId" });
  const { q } = useSearch({ from: "/whiteboard/$boardId" });
  const state = useLoadedBoard(boardId);

  switch (state.status) {
    case "loading":
      return <LoadingStatus>Wczytywanie tablicy…</LoadingStatus>;
    case "notFound":
      return <NotFoundPage />;
    case "error":
      return <ErrorMessage>{state.message}</ErrorMessage>;
    case "loaded":
      // Keyed so a different board starts with fresh editor state and its own autosave.
      return <BoardEditor key={boardId} boardId={boardId} item={state.item} searchQuery={q} />;
  }
}
