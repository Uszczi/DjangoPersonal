import { useRef, useState } from "react";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useWhiteboardsStore } from "@/stores/whiteboards";

/**
 * In-place renaming of a Notatnik item. The name is saved directly, not through autosave:
 * a taken name must come back as a message, not "Błąd zapisu".
 */
export function useBoardName(boardId: string, initialName: string) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const savedName = useRef(initialName);

  function startEditing() {
    savedName.current = name;
    setIsEditing(true);
  }

  async function save() {
    const trimmed = name.trim();
    setIsEditing(false);
    if (!trimmed) {
      setName(savedName.current);
      return;
    }
    if (trimmed === savedName.current) return;
    setName(trimmed);
    setError("");
    try {
      const updated = await api.whiteboardsPartialUpdate({
        id: Number(boardId),
        patchedWhiteboardRequest: { name: trimmed },
      });
      setName(updated.name);
      savedName.current = updated.name;
      useWhiteboardsStore.setState((s) => ({
        whiteboards: s.whiteboards.map((wb) => (wb.id === updated.id ? updated : wb)),
      }));
    } catch (err) {
      setName(savedName.current);
      setError(await apiErrorMessage(err));
    }
  }

  return {
    name,
    setName,
    isEditing,
    startEditing,
    cancelEditing: () => setIsEditing(false),
    save,
    error,
  };
}
