import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FolderInput, FolderPlus, Pencil } from "lucide-react";
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
import { MoveFolderModal, MoveWhiteboardModal } from "@/components/modals/MoveToFolderModal";
import { useFoldersStore } from "@/stores/folders";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore } from "@/stores/whiteboards";
import { useExpandedFolders } from "@/whiteboard/expandedFolders";
import { childFolders, subtreeIds } from "@/whiteboard/folderTree";

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
          {childFolders(folders, null).map((folder) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              folders={folders}
              whiteboards={whiteboards}
              isExpanded={isExpanded}
              onToggle={toggle}
              onCreate={(kind, folderId) => void handleCreate(kind, folderId)}
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
  /** Every Folder and item of the Notatnik; the section picks its own children. */
  folders: FolderResponse[];
  whiteboards: WhiteboardResponse[];
  isExpanded: (folderId: number) => boolean;
  onToggle: (folderId: number) => void;
  onCreate: (kind: Kind, folderId: number) => void;
};

/** A collapsible Folder: its subfolders first, alphabetically, then its items, newest first. */
function FolderSection({ folder, folders, whiteboards, isExpanded, onToggle, onCreate }: FolderSectionProps) {
  const expanded = isExpanded(folder.id);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const subfolders = childFolders(folders, folder.id);
  const items = whiteboards.filter((wb) => wb.folderId === folder.id);
  const subtree = subtreeIds(folders, folder.id);
  const totalItems = whiteboards.filter((wb) => wb.folderId != null && subtree.has(wb.folderId)).length;

  return (
    <section aria-label={`Folder: ${folder.name}`} className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-1 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={folder.name}
          onClick={() => onToggle(folder.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 py-1 text-left hover:bg-wash"
        >
          <Chevron aria-hidden="true" className="size-[16px] shrink-0 text-muted" />
          <span className="text-[16px]" aria-hidden="true">
            📁
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">{folder.name}</span>
          <span className="text-[12px] text-muted">{totalItems}</span>
        </button>
        <Button
          variant="secondary"
          aria-label={`Nowa tablica w folderze: ${folder.name}`}
          onClick={() => onCreate("whiteboard", folder.id)}
        >
          + tablica
        </Button>
        <Button
          variant="secondary"
          aria-label={`Nowa notatka w folderze: ${folder.name}`}
          onClick={() => onCreate("markdown", folder.id)}
        >
          + notatka
        </Button>
        <IconButton
          title="Nowy podfolder"
          aria-label={`Nowy folder w folderze: ${folder.name}`}
          className="text-[18px]"
          onClick={() => ShowModal(FolderEditorModal, { parent: folder })}
        >
          <FolderPlus aria-hidden="true" className="size-[16px]" />
        </IconButton>
        <IconButton
          title="Przenieś do…"
          aria-label={`Przenieś folder do…: ${folder.name}`}
          className="text-[18px]"
          onClick={() => ShowModal(MoveFolderModal, { folder })}
        >
          <FolderInput aria-hidden="true" className="size-[16px]" />
        </IconButton>
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
          onClick={() =>
            ShowModal(DeleteFolderModal, {
              folder,
              itemCount: totalItems,
              subfolderCount: subtree.size - 1,
            })
          }
        />
      </div>
      {expanded && (
        <div className="pb-2 pl-6">
          {subfolders.map((child) => (
            <FolderSection
              key={child.id}
              folder={child}
              folders={folders}
              whiteboards={whiteboards}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onCreate={onCreate}
            />
          ))}
          <ul className="flex flex-col" aria-label={`Zawartość folderu: ${folder.name}`}>
            {items.length === 0 && subfolders.length === 0 ? (
              <li className="py-2 text-[13px] text-muted">Folder jest pusty.</li>
            ) : (
              items.map((wb) => <WhiteboardRow key={wb.id} whiteboard={wb} />)
            )}
          </ul>
        </div>
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
