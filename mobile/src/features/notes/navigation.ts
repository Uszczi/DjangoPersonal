import { Alert } from "react-native";
import { router } from "expo-router";

import type { FolderResponse } from "@personal/shared/generated/api";

/** A Notatnik item as the lists need it; both the list and search results fit. */
export type NotatnikItem = { id: number; kind: string; name: string };

export function isNote(item: NotatnikItem) {
  return item.kind === "markdown";
}

/**
 * Open a Notatka in the editor, with `query` marked in its text. Tablice are
 * drawn with the mouse, so they open only in the web app.
 */
export function openItem(item: NotatnikItem, query?: string) {
  if (!isNote(item)) {
    Alert.alert(
      "Tablica",
      `„${item.name}” to tablica: otworzysz ją w przeglądarce, na komputerze.`,
    );
    return;
  }
  router.push({
    pathname: "/notes/[id]",
    params: query ? { id: item.id, q: query } : { id: item.id },
  });
}

export function openFolder(folder: FolderResponse) {
  router.push({ pathname: "/notes/folder/[id]", params: { id: folder.id } });
}

/** The day an item last changed, as the lists show it. */
export function formatChanged(date: Date | string) {
  // A list restored from the saved cache holds dates as strings.
  return new Date(date).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
