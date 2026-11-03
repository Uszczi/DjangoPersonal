import { ErrorMessage, LoadingStatus } from "@/design-system";
import type {
  FolderResponse,
  WhiteboardResponse,
} from "@personal/shared/generated/api";
import { folderPath, matchesQuery } from "@personal/shared/folderTree";
import { useNotatnikSearch } from "@personal/shared/useNotatnikSearch";

import { WhiteboardRow } from "./WhiteboardRow";
import { rowButtonClasses } from "./classes";

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
export function SearchResults({
  query,
  folders,
  whiteboards,
  activeId,
  onRevealFolder,
}: SearchResultsProps) {
  const search = useNotatnikSearch(query);
  const matchingFolders = folders.filter((folder) =>
    matchesQuery(folder.name, query),
  );
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
  if (
    search.status === "done" &&
    matchingFolders.length === 0 &&
    matchingItems.length === 0
  ) {
    return (
      <p className="px-[6px] py-2 text-[13px] text-muted">
        Nic nie pasuje do „{query.trim()}”.
      </p>
    );
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
              <span className="block truncate font-medium text-ink">
                {folder.name}
              </span>
              <small className="block truncate text-[11px] text-muted">
                {location(folder.parentId ?? null)}
              </small>
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
