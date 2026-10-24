import { useState } from "react";

/**
 * Request-id guard for async loads: the latest load wins, stale loads are
 * rejected. One instance per store (module level) or per component (via
 * `useLoadGuard`).
 */
export type LoadGuard = {
  /** Id for a newly started load. */
  nextRequestId(): number;
  /** True when no newer load has started after `requestId`. */
  isLatest(requestId: number): boolean;
};

export function createLoadGuard(): LoadGuard {
  let latestRequestId = 0;
  return {
    nextRequestId() {
      latestRequestId += 1;
      return latestRequestId;
    },
    isLatest(requestId) {
      return requestId === latestRequestId;
    },
  };
}

/** LoadGuard for React components (board editor route): one stable instance per component. */
export function useLoadGuard(): LoadGuard {
  const [guard] = useState<LoadGuard>(() => createLoadGuard());
  return guard;
}
