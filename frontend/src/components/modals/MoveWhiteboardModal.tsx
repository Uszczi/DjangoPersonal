import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { WhiteboardResponse } from "@personal/shared/generated/api";
import { useFoldersStore } from "@/stores/folders";
import { useWhiteboardsStore } from "@/stores/whiteboards";

type MoveWhiteboardModalProps = {
  whiteboard: WhiteboardResponse;
  onClose: () => void;
};

/** "Przenieś do…": every Folder plus "Bez folderu", except where the item already is. */
export function MoveWhiteboardModal({ whiteboard, onClose }: MoveWhiteboardModalProps) {
  const folders = useFoldersStore((state) => state.folders);
  const moveWhiteboard = useWhiteboardsStore((state) => state.moveWhiteboard);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  const currentFolderId = whiteboard.folderId ?? null;
  const targets = [
    ...folders.map((folder) => ({ id: folder.id as number | null, label: `📁 ${folder.name}`, name: folder.name })),
    { id: null, label: "Bez folderu", name: "Bez folderu" },
  ].filter((target) => target.id !== currentFolderId);

  function close() {
    if (!isMoving) onClose();
  }

  async function handleMove(folderId: number | null) {
    setIsMoving(true);
    setMoveError("");
    try {
      await moveWhiteboard(whiteboard.id, folderId);
      onClose();
    } catch (error) {
      setMoveError(await apiErrorMessage(error));
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <Modal
      kicker={whiteboard.name}
      title="Przenieś do…"
      titleId="whiteboard-move-title"
      onClose={close}
      size="md"
    >
      <ul className="mt-5 flex flex-col gap-1">
        {targets.map((target) => (
          <li key={target.id ?? "none"}>
            <button
              type="button"
              aria-label={target.name}
              disabled={isMoving}
              onClick={() => void handleMove(target.id)}
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
