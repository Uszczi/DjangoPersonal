import type { FolderResponse } from "@personal/shared/generated/api";

/** The API lists Folders flat, each with its parent; these helpers read that as a tree. */

/** The Folders directly inside `parentId` (`null`: the top level), in list order. */
export function childFolders(folders: FolderResponse[], parentId: number | null) {
  return folders.filter((folder) => (folder.parentId ?? null) === parentId);
}

/** `folderId` and every Folder below it. */
export function subtreeIds(folders: FolderResponse[], folderId: number): Set<number> {
  const ids = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId != null && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Every Folder in tree order (parents before children, siblings alphabetically), with its depth. */
export function flattenTree(folders: FolderResponse[]) {
  const rows: { folder: FolderResponse; depth: number }[] = [];
  function visit(parentId: number | null, depth: number) {
    for (const folder of childFolders(folders, parentId)) {
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  }
  visit(null, 0);
  return rows;
}

/** The Folders from the top level down to `folderId`, inclusive; empty for `null`. */
export function folderPath(folders: FolderResponse[], folderId: number | null): FolderResponse[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: FolderResponse[] = [];
  const seen = new Set<number>();
  let current = folderId != null ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Lowercase and without diacritics, so "zolw" finds "Żółw". */
export function searchKey(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase();
}

/** Whether `name` contains every word of `query`, ignoring case and diacritics. */
export function matchesQuery(name: string, query: string) {
  const key = searchKey(name);
  return searchKey(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => key.includes(word));
}
