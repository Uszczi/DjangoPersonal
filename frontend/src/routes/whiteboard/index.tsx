import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button, EmptyState, PageHeader } from "@/design-system";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { useFolders } from "@/queries/folders";
import { ShowModal } from "@/stores/modal";
import {
  useCreateItem,
  useWhiteboards,
  type ItemKind,
} from "@/queries/whiteboards";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

/**
 * The right side of the Notatnik before anything is open. The tree and its
 * actions live in the sidebar (`NotatnikSidebar`), so this only greets.
 */
function WhiteboardsPage() {
  const whiteboards = useWhiteboards();
  const folders = useFolders();
  const isEmpty = whiteboards.isSuccess && whiteboards.data.length === 0;
  const noFolders = folders.isSuccess && folders.data.length === 0;
  const createItem = useCreateItem();
  const navigate = useNavigate();

  async function handleCreate(kind: ItemKind) {
    let created;
    try {
      created = await createItem.mutateAsync({ kind });
    } catch {
      return;
    }
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
