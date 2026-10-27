import { useEffect, useState } from "react";

import { api } from "@personal/shared/api";
import type { WhiteboardSearchResult } from "@personal/shared/generated/api";

/** How long typing must pause before the search goes to the server. */
const DEBOUNCE_MS = 200;

export type NotatnikSearch =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; results: WhiteboardSearchResult[] };

/**
 * The server's search of Whiteboards and Notatki for `query` (names, and the
 * lines of each Notatka's text). Waits for typing to pause, and drops the
 * answers to queries that have since changed.
 */
export function useNotatnikSearch(query: string): NotatnikSearch {
  const q = query.trim();
  const [search, setSearch] = useState<{ q: string; state: NotatnikSearch }>({
    q: "",
    state: { status: "loading" },
  });

  useEffect(() => {
    if (q === "") return;
    let current = true;
    const timer = setTimeout(() => {
      api.whiteboardsSearch({ q }).then(
        (results) =>
          current && setSearch({ q, state: { status: "done", results } }),
        () => current && setSearch({ q, state: { status: "error" } }),
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);

  return search.q === q ? search.state : { status: "loading" };
}
