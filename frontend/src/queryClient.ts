import { QueryClient } from "@tanstack/react-query";

/**
 * The app's one server-state cache (TanStack Query; see
 * docs/adr/0005-tanstack-query-for-server-state.md). It lives at module level
 * so the root route can provide it and tests can clear it between renders.
 */
export const queryClient = new QueryClient();
