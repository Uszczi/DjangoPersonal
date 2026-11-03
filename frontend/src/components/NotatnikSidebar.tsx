import { useNavigate } from "@tanstack/react-router";
import {
  FilePlus,
  FolderPlus,
  MessageCircleQuestionMark,
  Palette,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { ErrorMessage, IconButton, LoadingStatus, TextInput } from "@/design-system";
import type { FolderResponse } from "@personal/shared/generated/api";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import {
  FOLDERS_LOAD_ERROR,
  WHITEBOARDS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useFolders } from "@personal/shared/queries/folders";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import {
  useCreateItem,
  useWhiteboards,
  type ItemKind,
} from "@personal/shared/queries/whiteboards";
import { useExpandedFolders } from "@/whiteboard/expandedFolders";
import { childFolders, folderPath } from "@personal/shared/folderTree";

import { FolderSection } from "./notatnik/FolderSection";
import { SearchResults } from "./notatnik/SearchResults";
import { WhiteboardRow } from "./notatnik/WhiteboardRow";
import { iconClasses, smallIconButton } from "./notatnik/classes";

type NotatnikSidebarProps = {
  /** The open item, highlighted and revealed in the tree; none on the Notatnik page. */
  activeId: number | null;
  /** Something fills the right side (an item, or the questions page); on small screens the tree then steps aside. */
  detailOpen?: boolean;
};

/**
 * The Notatnik as a file explorer: search, the Folder tree and every action on
 * Folders and items. The open item shows to its right. On small screens it
 * fills the Notatnik page and steps aside while an item is open.
 */
export function NotatnikSidebar({
  activeId,
  detailOpen = activeId != null,
}: NotatnikSidebarProps) {
  const {
    data: whiteboards = [],
    isPending: isLoading,
    isError,
  } = useWhiteboards();
  const createItem = useCreateItem();
  const {
    data: folders = [],
    isPending: foldersLoading,
    isError: isFoldersError,
  } = useFolders();
  const isCollapsed = useLayoutStore((s) => s.isNotatnikSidebarCollapsed);
  const toggleCollapsed = useLayoutStore((s) => s.toggleNotatnikSidebar);
  const { isExpanded, toggle, expand } = useExpandedFolders();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const activeFolderId =
    whiteboards.find((wb) => wb.id === activeId)?.folderId ?? null;
  const activePath = folderPath(folders, activeFolderId)
    .map((f) => f.id)
    .join(",");
  useEffect(() => {
    if (activePath) expand(activePath.split(",").map(Number));
    // `expand` is a fresh function each render; the path is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  async function handleCreate(kind: ItemKind, folderId: number | null = null) {
    let created;
    try {
      created = await createItem.mutateAsync({ kind, folderId });
    } catch {
      return;
    }
    navigate({
      to: "/whiteboard/$boardId",
      params: { boardId: String(created.id) },
    });
  }

  /** Leave the search and show `folder` in the tree, its ancestors expanded. */
  function revealFolder(folder: FolderResponse) {
    expand(folderPath(folders, folder.id).map((f) => f.id));
    setQuery("");
  }

  const panelClasses = [
    "shrink-0 self-start overflow-y-auto rounded-lg border border-line bg-surface md:sticky md:top-8 md:h-[calc(100vh-132px)]",
    detailOpen ? "max-md:hidden" : "max-md:w-full",
  ].join(" ");

  if (isCollapsed) {
    return (
      <aside className={`${panelClasses} p-2`} aria-label="Drzewo Notatnika">
        <IconButton
          className="text-[20px]"
          onClick={toggleCollapsed}
          aria-label="Rozwiń drzewo Notatnika"
          title="Rozwiń drzewo Notatnika"
        >
          <span aria-hidden="true">»</span>
        </IconButton>
      </aside>
    );
  }

  const looseItems = whiteboards.filter((wb) => wb.folderId == null);
  const searching = query.trim() !== "";

  let body: ReactNode;
  if (isLoading || foldersLoading) {
    body = <LoadingStatus>Wczytywanie tablic…</LoadingStatus>;
  } else if (isError || isFoldersError) {
    body = (
      <ErrorMessage>
        {isError ? WHITEBOARDS_LOAD_ERROR : FOLDERS_LOAD_ERROR}
      </ErrorMessage>
    );
  } else if (searching) {
    body = (
      <SearchResults
        query={query}
        folders={folders}
        whiteboards={whiteboards}
        activeId={activeId}
        onRevealFolder={revealFolder}
      />
    );
  } else {
    body = (
      <>
        {childFolders(folders, null).map((folder) => (
          <FolderSection
            key={folder.id}
            folder={folder}
            folders={folders}
            whiteboards={whiteboards}
            activeId={activeId}
            isExpanded={isExpanded}
            onToggle={toggle}
            onCreate={(kind, folderId) => void handleCreate(kind, folderId)}
          />
        ))}
        <ul className="flex flex-col" aria-label="Tablice">
          {looseItems.map((wb) => (
            <WhiteboardRow
              key={wb.id}
              whiteboard={wb}
              active={wb.id === activeId}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <aside
      className={`${panelClasses} flex flex-col gap-2 p-3 md:w-[300px]`}
      aria-label="Drzewo Notatnika"
    >
      <div className="flex items-center gap-0.5 pl-[6px]">
        <span className="mr-auto font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
          Notatnik
        </span>
        <IconButton
          className={smallIconButton}
          title="Nowa notatka"
          aria-label="Nowa notatka"
          onClick={() => void handleCreate("markdown")}
        >
          <FilePlus aria-hidden="true" className={iconClasses} />
        </IconButton>
        <IconButton
          className={smallIconButton}
          title="Nowa tablica"
          aria-label="Nowa tablica"
          onClick={() => void handleCreate("whiteboard")}
        >
          <Palette aria-hidden="true" className={iconClasses} />
        </IconButton>
        <IconButton
          className={smallIconButton}
          title="Nowy folder"
          aria-label="Nowy folder"
          onClick={() => ShowModal(FolderEditorModal)}
        >
          <FolderPlus aria-hidden="true" className={iconClasses} />
        </IconButton>
        <IconButton
          className={smallIconButton}
          title="Zapytaj Notatki"
          aria-label="Zapytaj Notatki"
          onClick={() => navigate({ to: "/whiteboard/ask" })}
        >
          <MessageCircleQuestionMark
            aria-hidden="true"
            className={iconClasses}
          />
        </IconButton>
        <IconButton
          className={`${smallIconButton} text-[20px] max-md:hidden`}
          onClick={toggleCollapsed}
          aria-label="Zwiń drzewo Notatnika"
          title="Zwiń drzewo Notatnika"
        >
          <span aria-hidden="true">«</span>
        </IconButton>
      </div>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted"
        />
        <TextInput
          type="search"
          aria-label="Szukaj w Notatniku"
          placeholder="Szukaj…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
        />
      </div>
      <div className="flex min-h-0 flex-col">{body}</div>
    </aside>
  );
}
