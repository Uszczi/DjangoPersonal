/**
 * The server-state cache both clients share (TanStack Query). Each app creates one
 * client at module level and provides it at its root.
 */
import { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../stores/auth";

/**
 * A fresh-enough window: a page shown again within it reuses the cache
 * instead of asking the server, while a visit after it refetches in the
 * background. Writes keep the cache in step themselves, so this only bounds
 * how stale another device's changes can look.
 */
const STALE_TIME_MS = 30_000;

export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: STALE_TIME_MS } },
  });

  // The cache holds one account's data: drop it when that account signs out or
  // another signs in, so nobody sees the previous user's data. A token refresh
  // keeps the same user and the cache.
  useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) queryClient.clear();
  });

  return queryClient;
}
