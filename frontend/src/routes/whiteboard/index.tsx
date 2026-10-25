import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useEffect } from "react";

import { api } from "@personal/shared/api";
import {
  Button,
  DeleteButton,
  ErrorMessage,
  IconButton,
  ListRow,
  ListRowButton,
  ListRowTitle,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import type { FolderResponse } from "@personal/shared/generated/api";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { useFoldersStore } from "@/stores/folders";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore } from "@/stores/whiteboards";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

function WhiteboardsPage() {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const remove = useWhiteboardsStore((s) => s.deleteWhiteboard);
  const folders = useFoldersStore((s) => s.folders);
  const foldersLoading = useFoldersStore((s) => s.isLoading);
  const foldersError = useFoldersStore((s) => s.pageError);
  const loadFolders = useFoldersStore((s) => s.loadFolders);

  const navigate = useNavigate();

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  async function handleCreate(kind: "whiteboard" | "markdown") {
    try {
      const created = await api.whiteboardsCreate({
        whiteboardRequest: { kind, name: "Bez tytułu" },
      });
      useWhiteboardsStore.setState((s) => ({ whiteboards: [created, ...s.whiteboards] }));
      navigate({ to: "/whiteboard/$boardId", params: { boardId: String(created.id) } });
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove(id);
  }

  if (isLoading || foldersLoading) {
    return (
      <LoadingStatus>
        Wczytywanie tablic…
      </LoadingStatus>
    );
  }

  if (pageError || foldersError) {
    return <ErrorMessage>{pageError || foldersError}</ErrorMessage>;
  }

  const newFolderButton = (
    <Button variant="secondary" onClick={() => ShowModal(FolderEditorModal)}>
      <span aria-hidden="true">+</span>
      Nowy folder
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Notatnik"
        actions={
          <>
            <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
              <span aria-hidden="true">+</span>
              Nowa tablica
            </Button>
            <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
              <span aria-hidden="true">+</span>
              Nowa notatka
            </Button>
            {newFolderButton}
          </>
        }
      />

      {whiteboards.length === 0 && folders.length === 0 ? (
        <div className="pt-[40px] text-muted">
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK NOTATEK</p>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Utwórz pierwszą notatkę</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }} className="mt-5">
            <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
              Nowa tablica
            </Button>
            <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
              Nowa notatka
            </Button>
            {newFolderButton}
          </div>
        </div>
      ) : (
        <>
          {folders.map((folder) => (
            <FolderSection key={folder.id} folder={folder} />
          ))}
          <ul className="flex flex-col" aria-label="Tablice">
            {whiteboards.map((wb) => (
              <ListRow key={wb.id}>
                <ListRowButton
                  aria-label={`Otwórz ${wb.kind === "markdown" ? "notatkę" : "tablicę"}: ${wb.name}`}
                  onClick={() =>
                    navigate({ to: "/whiteboard/$boardId", params: { boardId: String(wb.id) } })
                  }
                >
                  <span className="text-[16px]" aria-hidden="true">
                    {wb.kind === "markdown" ? "📝" : "🎨"}
                  </span>
                  <ListRowTitle>{wb.name}</ListRowTitle>
                </ListRowButton>
                <>
                  <span className="mr-2 text-[12px] text-muted">
                    {new Date(wb.updatedAt).toLocaleDateString("pl-PL")}
                  </span>
                  <DeleteButton
                    aria-label={`Usuń tablicę: ${wb.name}`}
                    onClick={() => void handleDelete(wb.id)}
                  />
                </>
              </ListRow>
            ))}
          </ul>
          <div className="mt-4">
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
                <span aria-hidden="true">+</span>
                Nowa tablica
              </Button>
              <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
                <span aria-hidden="true">+</span>
                Nowa notatka
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function FolderSection({ folder }: { folder: FolderResponse }) {
  return (
    <section aria-label={`Folder: ${folder.name}`} className="border-b border-line">
      <div className="flex items-center gap-2 py-2">
        <span className="text-[16px]" aria-hidden="true">
          📁
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{folder.name}</span>
        <IconButton
          title="Zmień nazwę"
          aria-label={`Zmień nazwę folderu: ${folder.name}`}
          className="text-[18px]"
          onClick={() => ShowModal(FolderEditorModal, { folder })}
        >
          <Pencil aria-hidden="true" className="size-[16px]" />
        </IconButton>
      </div>
    </section>
  );
}
