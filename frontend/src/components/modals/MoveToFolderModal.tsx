import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { FolderResponse, WhiteboardResponse } from "@personal/shared/generated/api";
import { useFoldersStore } from "@/stores/folders";
import { useWhiteboardsStore } from "@/stores/whiteboards";
import { flattenTree, subtreeIds } from "@/whiteboard/folderTree";

type MoveTargetsModalProps = {
  /** The name of what is being moved. */
  name: string;
  /** Where it is now (`null`: the top level); that place is not offered. */
  currentFolderId: number | null;
  /** Folders it may not go into. */
  excluded?: Set<number>;
  move: (folderId: number | null) => Promise<unknown>;
  onClose: () => void;
};

/** "Przenieś do…": every Folder as a tree plus "Bez folderu", except where it already is. */
function MoveTargetsModal({ name, currentFolderId, excluded, move, onClose }: MoveTargetsModalProps) {
  const folders = useFoldersStore((state) => state.folders);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  const paths = new Map<number, string>();
  const targets = flattenTree(folders).map(({ folder, depth }) => {
    const parentPath = folder.parentId != null ? paths.get(folder.parentId) : undefined;
    const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
    paths.set(folder.id, path);
    return { id: folder.id as number | null, label: `📁 ${folder.name}`, name: path, depth };
  });
  const offered = [...targets, { id: null, label: "Bez folderu", name: "Bez folderu", depth: 0 }].filter(
    (target) => target.id !== currentFolderId && !(target.id != null && excluded?.has(target.id)),
  );

  function close() {
    if (!isMoving) onClose();
  }

  async function handleMove(folderId: number | null) {
    setIsMoving(true);
    setMoveError("");
    try {
      await move(folderId);
      onClose();
    } catch (error) {
      setMoveError(await apiErrorMessage(error));
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <Modal kicker={name} title="Przenieś do…" titleId="move-to-folder-title" onClose={close} size="md">
      <ul className="mt-5 flex flex-col gap-1">
        {offered.map((target) => (
          <li key={target.id ?? "none"}>
            <button
              type="button"
              aria-label={target.name}
              disabled={isMoving}
              onClick={() => void handleMove(target.id)}
              style={{ paddingLeft: `${12 + target.depth * 20}px` }}
              className="w-full cursor-pointer rounded px-3 py-2 text-left text-[14px] text-ink hover:bg-wash disabled:cursor-default"
            >
              {target.label}
            </button>
          </li>
        ))}
      </ul>
      {moveError && <ErrorAlert>{moveError}</ErrorAlert>}
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={isMoving}>
          Anuluj
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function MoveWhiteboardModal({
  whiteboard,
  onClose,
}: {
  whiteboard: WhiteboardResponse;
  onClose: () => void;
}) {
  const moveWhiteboard = useWhiteboardsStore((state) => state.moveWhiteboard);
  return (
    <MoveTargetsModal
      name={whiteboard.name}
      currentFolderId={whiteboard.folderId ?? null}
      move={(folderId) => moveWhiteboard(whiteboard.id, folderId)}
      onClose={onClose}
    />
  );
}

/** A Folder can't go into itself or anything below it; "Bez folderu" means the top level. */
export function MoveFolderModal({ folder, onClose }: { folder: FolderResponse; onClose: () => void }) {
  const folders = useFoldersStore((state) => state.folders);
  const moveFolder = useFoldersStore((state) => state.moveFolder);
  return (
    <MoveTargetsModal
      name={folder.name}
      currentFolderId={folder.parentId ?? null}
      excluded={subtreeIds(folders, folder.id)}
      move={(parentId) => moveFolder(folder.id, parentId)}
      onClose={onClose}
    />
  );
}
