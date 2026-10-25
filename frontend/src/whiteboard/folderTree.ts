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
