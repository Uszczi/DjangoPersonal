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
const CACHE_VERSION = "4";

const DATE_TAG = "$date";

/**
 * The generated client turns dates into `Date`s, which plain JSON would bring
 * back as strings. So a `Date` is saved as `{"$date": "<ISO>"}` and revived on
 * load; tagging (rather than guessing from the string) leaves text that only
 * looks like a date alone.
 */
export function serializeCache(value: unknown): string {
  // `value` has already been through `Date.toJSON`; `this[key]` is the original.
  return JSON.stringify(
    value,
    function (this: Record<string, unknown>, key, json: unknown) {
      const original = this[key];
      return original instanceof Date
        ? { [DATE_TAG]: original.toISOString() }
        : json;
    },
  );
}

export function deserializeCache<T>(text: string): T {
  return JSON.parse(text, (_key, value: unknown) => {
    if (
      value !== null &&
      typeof value === "object" &&
      Object.keys(value).length === 1 &&
      typeof (value as Record<string, unknown>)[DATE_TAG] === "string"
    ) {
      return new Date((value as Record<string, string>)[DATE_TAG]);
    }
    return value;
  }) as T;
}

/** The options both apps hand to `PersistQueryClientProvider`. */
export const persistOptions: PersistQueryClientProviderProps["persistOptions"] =
  {
    persister: createAsyncStoragePersister({
      storage: platformCacheStorage,
      key: "personal-query-cache",
      serialize: serializeCache,
      deserialize: deserializeCache,
      // Out of room: drop the oldest query and try again rather than give up.
      retry: removeOldestQuery,
    }),
    maxAge: CACHE_MAX_AGE_MS,
    buster: CACHE_VERSION,
  };
