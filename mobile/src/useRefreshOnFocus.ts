import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Refetch when a screen comes back into view (a tab switch, closing a modal
 * on top of it). Tab screens stay mounted, so mounting alone does not do it.
 * The first focus is skipped: the query has just loaded on mount.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
