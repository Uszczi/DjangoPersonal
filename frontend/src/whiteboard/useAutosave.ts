import { useCallback, useEffect, useRef, useState } from "react";

import type { BoardDocument } from "@/whiteboard/boardDocument";

/** What can be saved; the wire format stays in the route. */
export type SavePayload =
  | { kind: "whiteboard"; doc: BoardDocument }
  | { kind: "markdown"; markdown: string };

export type SaveState = "saved" | "saving" | "failed";

const DEFAULT_DELAY_MS = 500;

/**
 * One autosave mechanism for Whiteboards and Notes: 500 ms debounce, `flush`
 * (Ctrl+S / "Zapisz" / unmount), `saveNow` for immediate writes, and
 * a saved/saving/failed indicator. The wire format stays in the route.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<void>,
  options?: { delay?: number },
) {
  const delay = options?.delay ?? DEFAULT_DELAY_MS;
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<T | null>(null);

  const persist = useCallback(
    async (value: T) => {
      setSaveState("saving");
      try {
        await save(value);
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    },
    [save],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestRef.current !== null) await persist(latestRef.current);
  }, [persist]);

  const saveNow = useCallback(
    (value: T) => {
      latestRef.current = value;
      void persist(value);
    },
    [persist],
  );

  const schedule = useCallback(
    (value: T) => {
      latestRef.current = value;
      setSaveState("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist(value);
      }, delay);
    },
    [persist, delay],
  );

  // Flush pending changes on unmount so quick navigation never loses edits.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const latest = latestRef.current;
      if (latest !== null) void persist(latest);
    };
  }, [persist]);

  return { saveState, schedule, flush, saveNow };
}
