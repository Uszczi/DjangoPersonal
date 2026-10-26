import { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@personal/shared/stores/auth";

/**
 * The app's one server-state cache (TanStack Query; see
 * docs/adr/0005-tanstack-query-for-server-state.md). It lives at module level
 * so the root route can provide it and tests can clear it between renders.
 */
export const queryClient = new QueryClient();

// The cache holds one account's data: drop it when that account signs out or
// another signs in, so nobody sees the previous user's transactions. A token
// refresh keeps the same user and the cache.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) queryClient.clear();
});
