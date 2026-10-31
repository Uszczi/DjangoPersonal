import { router } from "expo-router";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  FolderResponse,
  WhiteboardResponse,
} from "@personal/shared/generated/api";
import { useDeleteFolder } from "@personal/shared/queries/folders";
import { useDeleteWhiteboard } from "@personal/shared/queries/whiteboards";

import { confirmDestructive } from "@/ui/confirm";
import { Sheet, SheetItem } from "@/ui/Sheet";

import { isNote } from "@/features/notes/navigation";

/** What a long press in the Notatnik acts on. */
export type NotatnikTarget =
  | { type: "folder"; folder: FolderResponse }
  | { type: "item"; item: WhiteboardResponse };

function targetParams(target: NotatnikTarget) {
  return target.type === "folder"
    ? { target: "folder", id: target.folder.id }
    : { target: "item", id: target.item.id };
}

/** Rename, move or delete a Folder, a Notatka or a Tablica. */
export function NotatnikActionsSheet({
  target,
  onClose,
  onError,
  onDeleted,
}: {
  target: NotatnikTarget;
  onClose: () => void;
  onError: (message: string) => void;
  /** After a delete, for a screen showing the deleted thing itself. */
  onDeleted?: () => void;
}) {
  const deleteFolder = useDeleteFolder();
  const deleteWhiteboard = useDeleteWhiteboard();
  const name = target.type === "folder" ? target.folder.name : target.item.name;
  const title =
    target.type === "folder"
      ? "Folder"
      : isNote(target.item)
        ? "Notatka"
        : "Tablica";

  function open(pathname: "/notatnik-name" | "/move-to-folder") {
    onClose();
    router.push({ pathname, params: targetParams(target) });
  }

  async function remove() {
    onClose();
    const message =
      target.type === "folder"
        ? `„${name}” zostanie usunięty razem z podfolderami i wszystkim, co w nich jest.`
        : `„${name}” zostanie usunięta.`;
    const confirmed = await confirmDestructive(
      target.type === "folder" ? "Usunąć folder?" : "Usunąć?",
      message,
      "Usuń",
    );
    if (!confirmed) return;
    try {
      if (target.type === "folder") {
        await deleteFolder.mutateAsync(target.folder.id);
      } else {
        await deleteWhiteboard.mutateAsync(target.item.id);
      }
      onDeleted?.();
    } catch (error) {
      onError(await apiErrorMessage(error));
    }
  }

  return (
    <Sheet title={`${title}: ${name}`} onClose={onClose}>
      <SheetItem
        icon="pencil-outline"
        label="Zmień nazwę"
        onPress={() => open("/notatnik-name")}
      />
      <SheetItem
        icon="folder-open-outline"
        label="Przenieś do folderu"
        onPress={() => open("/move-to-folder")}
      />
      <SheetItem
        icon="trash-outline"
        label="Usuń"
        onPress={() => void remove()}
      />
    </Sheet>
  );
}
