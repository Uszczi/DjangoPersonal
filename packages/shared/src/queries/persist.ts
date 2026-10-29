/**
 * Keeps the server-state cache across app starts, so a reload or a cold start
 * paints the last data at once and refetches it in the background, instead of
 * showing "Wczytywanie…" until the server answers.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  type PersistQueryClientProviderProps,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";

import { platformCacheStorage } from "../platform";

/**
 * How long a saved cache is worth restoring. The query client keeps unused
 * queries this long too (`gcTime`), or they would drop out of the saved copy.
 */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Bump when a cached response's shape changes incompatibly, so clients drop a
 * cache saved by an older version instead of rendering it.
 */
const CACHE_VERSION = "1";

/** The options both apps hand to `PersistQueryClientProvider`. */
export const persistOptions: PersistQueryClientProviderProps["persistOptions"] =
  {
    persister: createAsyncStoragePersister({
      storage: platformCacheStorage,
      key: "personal-query-cache",
      // Out of room: drop the oldest query and try again rather than give up.
      retry: removeOldestQuery,
    }),
    maxAge: CACHE_MAX_AGE_MS,
    buster: CACHE_VERSION,
  };
