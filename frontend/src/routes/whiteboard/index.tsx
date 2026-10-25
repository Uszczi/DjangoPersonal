import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, FolderInput, FolderPlus, Pencil, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@personal/shared/api";
import {
  Button,
  DeleteButton,
  ErrorMessage,
  IconButton,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
  LoadingStatus,
  PageHeader,
  TextInput,
} from "@/design-system";
import type { FolderResponse, MatchingLine, WhiteboardResponse } from "@personal/shared/generated/api";
import { DeleteFolderModal } from "@/components/modals/DeleteFolderModal";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import { MoveFolderModal, MoveWhiteboardModal } from "@/components/modals/MoveToFolderModal";
import { useFoldersStore } from "@/stores/folders";
import { ShowModal } from "@/stores/modal";
import { useWhiteboardsStore } from "@/stores/whiteboards";
import { useExpandedFolders } from "@/whiteboard/expandedFolders";
import { childFolders, folderPath, matchesQuery, subtreeIds } from "@/whiteboard/folderTree";
import { useNotatnikSearch } from "@/whiteboard/useNotatnikSearch";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

type Kind = "whiteboard" | "markdown";

/** How many matching lines a search result shows before "i N więcej". */
const SHOWN_LINES = 3;

function WhiteboardsPage() {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const folders = useFoldersStore((s) => s.folders);
  const foldersLoading = useFoldersStore((s) => s.isLoading);
  const foldersError = useFoldersStore((s) => s.pageError);
  const loadFolders = useFoldersStore((s) => s.loadFolders);
  const { isExpanded, toggle, expand } = useExpandedFolders();
  const [query, setQuery] = useState("");

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
  const searching = query.trim() !== "";

  /** Leave the search and show `folder` in the tree, its ancestors expanded. */
  function revealFolder(folder: FolderResponse) {
    expand(folderPath(folders, folder.id).map((f) => f.id));
    setQuery("");
  }

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
          <div className="relative mb-3">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-[16px] -translate-y-1/2 text-muted"
            />
            <TextInput
              type="search"
              aria-label="Szukaj w Notatniku"
              placeholder="Szukaj folderów, tablic i notatek…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
            />
          </div>
          {searching ? (
            <SearchResults
              query={query}
              folders={folders}
              whiteboards={whiteboards}
              onRevealFolder={revealFolder}
            />
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
      )}
    </>
  );
}

type SearchResultsProps = {
  query: string;
  folders: FolderResponse[];
  whiteboards: WhiteboardResponse[];
  onRevealFolder: (folder: FolderResponse) => void;
};

/**
 * The Folders whose names match `query`, then the items the server found
 * (by name, or a Notatka by its text), flat, each with the Folders it sits in
 * and a Notatka's matching lines.
 */
function SearchResults({ query, folders, whiteboards, onRevealFolder }: SearchResultsProps) {
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
    return <p className="py-4 text-[13px] text-muted">Nic nie pasuje do „{query.trim()}”.</p>;
  }

  return (
    <ul className="flex flex-col" aria-label="Wyniki wyszukiwania">
      {matchingFolders.map((folder) => (
        <ListRow key={`folder-${folder.id}`}>
          <ListRowButton aria-label={`Pokaż folder: ${folder.name}`} onClick={() => onRevealFolder(folder)}>
            <span className="text-[16px]" aria-hidden="true">
              📁
            </span>
            <div className="min-w-0">
              <ListRowTitle>{folder.name}</ListRowTitle>
              <ListRowSubtitle>{location(folder.parentId ?? null)}</ListRowSubtitle>
            </div>
          </ListRowButton>
          <></>
        </ListRow>
      ))}
      {matchingItems.map(({ wb, lines }) => (
        <WhiteboardRow key={wb.id} whiteboard={wb} location={location(wb.folderId ?? null)} lines={lines} />
      ))}
    </ul>
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

type WhiteboardRowProps = {
  whiteboard: WhiteboardResponse;
  /** The Folder path, shown under the name in search results. */
  location?: string;
  /** The lines of its text that matched a search. */
  lines?: MatchingLine[];
};

function WhiteboardRow({ whiteboard: wb, location, lines = [] }: WhiteboardRowProps) {
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
        {location === undefined ? (
          <ListRowTitle>{wb.name}</ListRowTitle>
        ) : (
          <div className="min-w-0">
            <ListRowTitle>{wb.name}</ListRowTitle>
            <ListRowSubtitle>{location}</ListRowSubtitle>
            {lines.length > 0 && <MatchingLines lines={lines} />}
          </div>
        )}
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

/** Grep-style: each matching line with its number, the first few only. */
function MatchingLines({ lines }: { lines: MatchingLine[] }) {
  const hidden = lines.length - SHOWN_LINES;
  return (
    <span role="list" aria-label="Pasujące linie" className="mt-1 block font-mono text-[12px] leading-relaxed">
      {lines.slice(0, SHOWN_LINES).map((line) => (
        <span role="listitem" key={line.number} className="flex min-w-0 gap-2">
          <span className="w-8 shrink-0 text-right text-muted tabular-nums">{line.number}</span>
          <span className="min-w-0 truncate text-ink">{line.text}</span>
        </span>
      ))}
      {hidden > 0 && <span className="block pl-10 text-muted">i {hidden} więcej</span>}
    </span>
  );
}
