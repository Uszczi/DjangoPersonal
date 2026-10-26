import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderInput,
  FolderPlus,
  Palette,
  Pencil,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { DeleteButton, ErrorMessage, IconButton, LoadingStatus, TextInput } from "@/design-system";
import type { FolderResponse, MatchingLine, WhiteboardResponse } from "@personal/shared/generated/api";
import { DeleteFolderModal } from "@/components/modals/DeleteFolderModal";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { MoveFolderModal, MoveWhiteboardModal } from "@/components/modals/MoveToFolderModal";
import { useFoldersStore } from "@/stores/folders";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore, type ItemKind } from "@/stores/whiteboards";
import { useExpandedFolders } from "@/whiteboard/expandedFolders";
import { childFolders, folderPath, matchesQuery, subtreeIds } from "@/whiteboard/folderTree";
import { useNotatnikSearch } from "@/whiteboard/useNotatnikSearch";

/** How many matching lines a search result shows before "i N więcej". */
const SHOWN_LINES = 3;

const iconClasses = "size-[15px]";
const smallIconButton = "h-7 w-7 text-[16px]";

/** Shown on hover or focus; always on touch screens, which cannot hover. */
const rowActionsClasses =
  "absolute top-1/2 right-0 flex -translate-y-1/2 items-center rounded-md bg-surface pl-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:static pointer-coarse:translate-y-0 pointer-coarse:opacity-100";

const rowButtonClasses =
  "flex min-h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-[6px] py-1 text-left text-[13px] text-ink-soft transition-colors hover:bg-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

type NotatnikSidebarProps = {
  /** The open item, highlighted and revealed in the tree; none on the Notatnik page. */
  activeId: number | null;
};

/**
 * The Notatnik as a file explorer: search, the Folder tree and every action on
 * Folders and items. The open item shows to its right. On small screens it
 * fills the Notatnik page and steps aside while an item is open.
 */
export function NotatnikSidebar({ activeId }: NotatnikSidebarProps) {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const createItem = useWhiteboardsStore((s) => s.createItem);
  const folders = useFoldersStore((s) => s.folders);
  const foldersLoading = useFoldersStore((s) => s.isLoading);
  const foldersError = useFoldersStore((s) => s.pageError);
  const loadFolders = useFoldersStore((s) => s.loadFolders);
  const isCollapsed = useLayoutStore((s) => s.isNotatnikSidebarCollapsed);
  const toggleCollapsed = useLayoutStore((s) => s.toggleNotatnikSidebar);
  const { isExpanded, toggle, expand } = useExpandedFolders();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const activeFolderId = whiteboards.find((wb) => wb.id === activeId)?.folderId ?? null;
  const activePath = folderPath(folders, activeFolderId)
    .map((f) => f.id)
    .join(",");
  useEffect(() => {
    if (activePath) expand(activePath.split(",").map(Number));
    // `expand` is a fresh function each render; the path is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  async function handleCreate(kind: ItemKind, folderId: number | null = null) {
    const created = await createItem(kind, folderId);
    if (created) navigate({ to: "/whiteboard/$boardId", params: { boardId: String(created.id) } });
  }

  /** Leave the search and show `folder` in the tree, its ancestors expanded. */
  function revealFolder(folder: FolderResponse) {
    expand(folderPath(folders, folder.id).map((f) => f.id));
    setQuery("");
  }

  const panelClasses = [
    "shrink-0 self-start overflow-y-auto rounded-lg border border-line bg-surface md:sticky md:top-8 md:h-[calc(100vh-132px)]",
    activeId != null ? "max-md:hidden" : "max-md:w-full",
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
  } else if (pageError || foldersError) {
    body = <ErrorMessage>{pageError || foldersError}</ErrorMessage>;
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
            <WhiteboardRow key={wb.id} whiteboard={wb} active={wb.id === activeId} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <aside className={`${panelClasses} flex flex-col gap-2 p-3 md:w-[300px]`} aria-label="Drzewo Notatnika">
      <div className="flex items-center gap-0.5 pl-[6px]">
        <span className="mr-auto font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Notatnik</span>
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

type SearchResultsProps = {
  query: string;
  folders: FolderResponse[];
  whiteboards: WhiteboardResponse[];
  activeId: number | null;
  onRevealFolder: (folder: FolderResponse) => void;
};

/**
 * The Folders whose names match `query`, then the items the server found
 * (by name, or a Notatka by its text), flat, each with the Folders it sits in
 * and a Notatka's matching lines.
 */
function SearchResults({ query, folders, whiteboards, activeId, onRevealFolder }: SearchResultsProps) {
  const search = useNotatnikSearch(query);
  const matchingFolders = folders.filter((folder) => matchesQuery(folder.name, query));
  // Rows come from the store, so a result moved or deleted here updates at once.
  const byId = new Map(whiteboards.map((wb) => [wb.id, wb]));
  const matchingItems =
    search.status === "done"
      ? search.results.flatMap((hit) => {
          const wb = byId.get(hit.id);
          return wb ? [{ wb, lines: hit.lines }] : [];
        })
      : [];
  const location = (folderId: number | null) =>
    folderPath(folders, folderId)
      .map((f) => f.name)
      .join(" / ") || "Bez folderu";

  if (search.status === "error") {
    return <ErrorMessage>Nie udało się przeszukać Notatnika.</ErrorMessage>;
  }
  if (search.status === "loading" && matchingFolders.length === 0) {
    return <LoadingStatus>Szukanie…</LoadingStatus>;
  }
  if (search.status === "done" && matchingFolders.length === 0 && matchingItems.length === 0) {
    return <p className="px-[6px] py-2 text-[13px] text-muted">Nic nie pasuje do „{query.trim()}”.</p>;
  }

  return (
    <ul className="flex flex-col" aria-label="Wyniki wyszukiwania">
      {matchingFolders.map((folder) => (
        <li key={`folder-${folder.id}`}>
          <button
            type="button"
            className={rowButtonClasses}
            aria-label={`Pokaż folder: ${folder.name}`}
            onClick={() => onRevealFolder(folder)}
          >
            <span aria-hidden="true">📁</span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{folder.name}</span>
              <small className="block truncate text-[11px] text-muted">{location(folder.parentId ?? null)}</small>
            </span>
          </button>
        </li>
      ))}
      {matchingItems.map(({ wb, lines }) => (
        <WhiteboardRow
          key={wb.id}
          whiteboard={wb}
          active={wb.id === activeId}
          location={location(wb.folderId ?? null)}
          lines={lines}
          searchQuery={lines.length > 0 ? query.trim() : undefined}
        />
      ))}
    </ul>
  );
}

type FolderSectionProps = {
  folder: FolderResponse;
  /** Every Folder and item of the Notatnik; the section picks its own children. */
  folders: FolderResponse[];
  whiteboards: WhiteboardResponse[];
  activeId: number | null;
  isExpanded: (folderId: number) => boolean;
  onToggle: (folderId: number) => void;
  onCreate: (kind: ItemKind, folderId: number) => void;
};

/** A collapsible Folder: its subfolders first, alphabetically, then its items, newest first. */
function FolderSection({
  folder,
  folders,
  whiteboards,
  activeId,
  isExpanded,
  onToggle,
  onCreate,
}: FolderSectionProps) {
  const expanded = isExpanded(folder.id);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const subfolders = childFolders(folders, folder.id);
  const items = whiteboards.filter((wb) => wb.folderId === folder.id);
  const subtree = subtreeIds(folders, folder.id);
  const totalItems = whiteboards.filter((wb) => wb.folderId != null && subtree.has(wb.folderId)).length;

  return (
    <section aria-label={`Folder: ${folder.name}`}>
      <div className="group relative flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={folder.name}
          onClick={() => onToggle(folder.id)}
          className={rowButtonClasses}
        >
          <Chevron aria-hidden="true" className="size-[14px] shrink-0 text-muted" />
          <span aria-hidden="true">📁</span>
          <span className="min-w-0 truncate font-semibold text-ink">{folder.name}</span>
          <span className="text-[11px] text-muted">{totalItems}</span>
        </button>
        <div className={rowActionsClasses}>
          <IconButton
            className={smallIconButton}
            title="Nowa notatka"
            aria-label={`Nowa notatka w folderze: ${folder.name}`}
            onClick={() => onCreate("markdown", folder.id)}
          >
            <FilePlus aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Nowa tablica"
            aria-label={`Nowa tablica w folderze: ${folder.name}`}
            onClick={() => onCreate("whiteboard", folder.id)}
          >
            <Palette aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Nowy podfolder"
            aria-label={`Nowy folder w folderze: ${folder.name}`}
            onClick={() => ShowModal(FolderEditorModal, { parent: folder })}
          >
            <FolderPlus aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Przenieś do…"
            aria-label={`Przenieś folder do…: ${folder.name}`}
            onClick={() => ShowModal(MoveFolderModal, { folder })}
          >
            <FolderInput aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Zmień nazwę"
            aria-label={`Zmień nazwę folderu: ${folder.name}`}
            onClick={() => ShowModal(FolderEditorModal, { folder })}
          >
            <Pencil aria-hidden="true" className={iconClasses} />
          </IconButton>
          <DeleteButton
            className={smallIconButton}
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
      </div>
      {expanded && (
        <div className="pl-4">
          {subfolders.map((child) => (
            <FolderSection
              key={child.id}
              folder={child}
              folders={folders}
              whiteboards={whiteboards}
              activeId={activeId}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onCreate={onCreate}
            />
          ))}
          <ul className="flex flex-col" aria-label={`Zawartość folderu: ${folder.name}`}>
            {items.length === 0 && subfolders.length === 0 ? (
              <li className="px-[6px] py-1 text-[12px] text-muted">Folder jest pusty.</li>
            ) : (
              items.map((wb) => <WhiteboardRow key={wb.id} whiteboard={wb} active={wb.id === activeId} />)
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

type WhiteboardRowProps = {
  whiteboard: WhiteboardResponse;
  /** The item open on the right. */
  active: boolean;
  /** The Folder path, shown under the name in search results. */
  location?: string;
  /** The lines of its text that matched a search. */
  lines?: MatchingLine[];
  /** The search its text matched; the Notatka opens searching for it. */
  searchQuery?: string;
};

function WhiteboardRow({ whiteboard: wb, active, location, lines = [], searchQuery }: WhiteboardRowProps) {
  const remove = useWhiteboardsStore((s) => s.deleteWhiteboard);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove(wb.id);
    if (active) navigate({ to: "/whiteboard" });
  }

  return (
    <li className="group relative">
      <button
        type="button"
        aria-label={`Otwórz ${wb.kind === "markdown" ? "notatkę" : "tablicę"}: ${wb.name}`}
        aria-current={active ? "page" : undefined}
        className={`${rowButtonClasses} aria-[current]:bg-wash aria-[current]:font-semibold aria-[current]:text-ink`}
        onClick={() =>
          navigate({
            to: "/whiteboard/$boardId",
            params: { boardId: String(wb.id) },
            search: searchQuery ? { q: searchQuery } : {},
          })
        }
      >
        <span className="w-[14px] shrink-0" aria-hidden="true" />
        <span aria-hidden="true">{wb.kind === "markdown" ? "📝" : "🎨"}</span>
        {location === undefined ? (
          <span className="min-w-0 truncate">{wb.name}</span>
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-ink">{wb.name}</span>
            <small className="block truncate text-[11px] text-muted">{location}</small>
            {lines.length > 0 && <MatchingLines lines={lines} />}
          </span>
        )}
      </button>
      <div className={`${rowActionsClasses} ${location !== undefined ? "top-[18px]" : ""}`}>
        <IconButton
          className={smallIconButton}
          title="Przenieś do…"
          aria-label={`Przenieś do…: ${wb.name}`}
          onClick={() => ShowModal(MoveWhiteboardModal, { whiteboard: wb })}
        >
          <FolderInput aria-hidden="true" className={iconClasses} />
        </IconButton>
        <DeleteButton
          className={smallIconButton}
          aria-label={`Usuń tablicę: ${wb.name}`}
          onClick={() => void handleDelete()}
        />
      </div>
    </li>
  );
}

/** Grep-style: each matching line with its number, the first few only. */
function MatchingLines({ lines }: { lines: MatchingLine[] }) {
  const hidden = lines.length - SHOWN_LINES;
  return (
    <span role="list" aria-label="Pasujące linie" className="mt-1 block font-mono text-[11px] leading-relaxed">
      {lines.slice(0, SHOWN_LINES).map((line) => (
        <span role="listitem" key={line.number} className="flex min-w-0 gap-2">
          <span className="w-6 shrink-0 text-right text-muted tabular-nums">{line.number}</span>
          <span className="min-w-0 truncate text-ink">{line.text}</span>
        </span>
      ))}
      {hidden > 0 && <span className="block pl-8 text-muted">i {hidden} więcej</span>}
    </span>
  );
}
