import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FolderInput, Pencil } from "lucide-react";
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
import type { FolderResponse, WhiteboardResponse } from "@personal/shared/generated/api";
import { DeleteFolderModal } from "@/components/modals/DeleteFolderModal";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { MoveWhiteboardModal } from "@/components/modals/MoveWhiteboardModal";
import { useFoldersStore } from "@/stores/folders";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore } from "@/stores/whiteboards";
import { useExpandedFolders } from "@/whiteboard/expandedFolders";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

type Kind = "whiteboard" | "markdown";

function WhiteboardsPage() {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const folders = useFoldersStore((s) => s.folders);
  const foldersLoading = useFoldersStore((s) => s.isLoading);
  const foldersError = useFoldersStore((s) => s.pageError);
  const loadFolders = useFoldersStore((s) => s.loadFolders);
  const { isExpanded, toggle } = useExpandedFolders();

  const navigate = useNavigate();

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  async function handleCreate(kind: Kind, folderId: number | null = null) {
    try {
      const created = await api.whiteboardsCreate({
        whiteboardRequest: { kind, name: "Bez tytułu", folderId },
      });
      useWhiteboardsStore.setState((s) => ({ whiteboards: [created, ...s.whiteboards] }));
      navigate({ to: "/whiteboard/$boardId", params: { boardId: String(created.id) } });
    } catch {
      // ignore
    }
  }

  if (isLoading || foldersLoading) {
    return <LoadingStatus>Wczytywanie tablic…</LoadingStatus>;
  }

  if (pageError || foldersError) {
    return <ErrorMessage>{pageError || foldersError}</ErrorMessage>;
  }

  const looseItems = whiteboards.filter((wb) => wb.folderId == null);

  const createButtons = (
    <>
      <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
        <span aria-hidden="true">+</span>
        Nowa tablica
      </Button>
      <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
        <span aria-hidden="true">+</span>
        Nowa notatka
      </Button>
    </>
  );
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
            {createButtons}
            {newFolderButton}
          </>
        }
      />

      {whiteboards.length === 0 && folders.length === 0 ? (
        <div className="pt-[40px] text-muted">
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK NOTATEK</p>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Utwórz pierwszą notatkę</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }} className="mt-5">
            {createButtons}
            {newFolderButton}
          </div>
        </div>
      ) : (
        <>
          {folders.map((folder) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              items={whiteboards.filter((wb) => wb.folderId === folder.id)}
              expanded={isExpanded(folder.id)}
              onToggle={() => toggle(folder.id)}
              onCreate={(kind) => void handleCreate(kind, folder.id)}
            />
          ))}
          <ul className="flex flex-col" aria-label="Tablice">
            {looseItems.map((wb) => (
              <WhiteboardRow key={wb.id} whiteboard={wb} />
            ))}
          </ul>
          <div className="mt-4">
            <div style={{ display: "flex", gap: 8 }}>{createButtons}</div>
          </div>
        </>
      )}
    </>
  );
}

type FolderSectionProps = {
  folder: FolderResponse;
  /** The folder's Whiteboards and Notatki, most recently changed first. */
  items: WhiteboardResponse[];
  expanded: boolean;
  onToggle: () => void;
  onCreate: (kind: Kind) => void;
};

function FolderSection({ folder, items, expanded, onToggle, onCreate }: FolderSectionProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <section aria-label={`Folder: ${folder.name}`} className="border-b border-line">
      <div className="flex items-center gap-1 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={folder.name}
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 py-1 text-left hover:bg-wash"
        >
          <Chevron aria-hidden="true" className="size-[16px] shrink-0 text-muted" />
          <span className="text-[16px]" aria-hidden="true">
            📁
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">{folder.name}</span>
          <span className="text-[12px] text-muted">{items.length}</span>
        </button>
        <Button
          variant="secondary"
          aria-label={`Nowa tablica w folderze: ${folder.name}`}
          onClick={() => onCreate("whiteboard")}
        >
          + tablica
        </Button>
        <Button
          variant="secondary"
          aria-label={`Nowa notatka w folderze: ${folder.name}`}
          onClick={() => onCreate("markdown")}
        >
          + notatka
        </Button>
        <IconButton
          title="Zmień nazwę"
          aria-label={`Zmień nazwę folderu: ${folder.name}`}
          className="text-[18px]"
          onClick={() => ShowModal(FolderEditorModal, { folder })}
        >
          <Pencil aria-hidden="true" className="size-[16px]" />
        </IconButton>
        <DeleteButton
          aria-label={`Usuń folder: ${folder.name}`}
          onClick={() => ShowModal(DeleteFolderModal, { folder, itemCount: items.length })}
        />
      </div>
      {expanded && (
        <ul className="flex flex-col pb-2 pl-6" aria-label={`Zawartość folderu: ${folder.name}`}>
          {items.length === 0 ? (
            <li className="py-2 text-[13px] text-muted">Folder jest pusty.</li>
          ) : (
            items.map((wb) => <WhiteboardRow key={wb.id} whiteboard={wb} />)
          )}
        </ul>
      )}
    </section>
  );
}

function WhiteboardRow({ whiteboard: wb }: { whiteboard: WhiteboardResponse }) {
  const remove = useWhiteboardsStore((s) => s.deleteWhiteboard);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove(wb.id);
  }

  return (
    <ListRow>
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
        <IconButton
          title="Przenieś do…"
          aria-label={`Przenieś do…: ${wb.name}`}
          className="text-[18px]"
          onClick={() => ShowModal(MoveWhiteboardModal, { whiteboard: wb })}
        >
          <FolderInput aria-hidden="true" className="size-[16px]" />
        </IconButton>
        <DeleteButton aria-label={`Usuń tablicę: ${wb.name}`} onClick={() => void handleDelete()} />
      </>
    </ListRow>
  );
}
