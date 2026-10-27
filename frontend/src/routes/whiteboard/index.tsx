import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button, EmptyState, PageHeader } from "@/design-system";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { useFoldersStore } from "@/stores/folders";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore, type ItemKind } from "@/stores/whiteboards";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

/**
 * The right side of the Notatnik before anything is open. The tree and its
 * actions live in the sidebar (`NotatnikSidebar`), so this only greets.
 */
function WhiteboardsPage() {
  const isEmpty = useWhiteboardsStore(
    (s) => !s.isLoading && !s.pageError && s.whiteboards.length === 0,
  );
  const noFolders = useFoldersStore(
    (s) => !s.isLoading && !s.pageError && s.folders.length === 0,
  );
  const createItem = useWhiteboardsStore((s) => s.createItem);
  const navigate = useNavigate();

  async function handleCreate(kind: ItemKind) {
    const created = await createItem(kind);
    if (created)
      navigate({
        to: "/whiteboard/$boardId",
        params: { boardId: String(created.id) },
      });
  }

  return (
    <>
      <PageHeader title="Notatnik" />
      {isEmpty && noFolders ? (
        <EmptyState eyebrow="BRAK NOTATEK" title="Utwórz pierwszą notatkę">
          <Button
            variant="primary"
            onClick={() => void handleCreate("markdown")}
          >
            <span aria-hidden="true">+</span>
            Nowa notatka
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleCreate("whiteboard")}
          >
            <span aria-hidden="true">+</span>
            Nowa tablica
          </Button>
          <Button
            variant="secondary"
            onClick={() => ShowModal(FolderEditorModal)}
          >
            <span aria-hidden="true">+</span>
            Nowy folder
          </Button>
        </EmptyState>
      ) : (
        <p className="pt-[40px] text-[14px] text-muted">
          Wybierz notatkę lub tablicę z drzewa po lewej albo utwórz nową.
        </p>
      )}
    </>
  );
}
