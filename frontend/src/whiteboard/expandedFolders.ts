import { useState } from "react";

const STORAGE_KEY = "notatnik.expandedFolders";

function readExpanded(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

function writeExpanded(ids: number[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private windows and blocked storage: the page works, it just forgets.
  }
}

/**
 * Which Notatnik Folders are expanded. Kept per browser, so the Notatnik looks the
 * same on the next visit; everything starts collapsed when storage is unavailable.
 */
export function useExpandedFolders() {
  const [expanded, setExpanded] = useState<number[]>(readExpanded);

  function toggle(folderId: number) {
    setExpanded((current) => {
      const next = current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId];
      writeExpanded(next);
      return next;
    });
  }

  /** Expand every Folder in `folderIds`, leaving the others as they are. */
  function expand(folderIds: number[]) {
    setExpanded((current) => {
      const next = [...current, ...folderIds.filter((id) => !current.includes(id))];
      writeExpanded(next);
      return next;
    });
  }

  return { isExpanded: (folderId: number) => expanded.includes(folderId), toggle, expand };
}
