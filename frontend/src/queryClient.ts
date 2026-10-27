import { createQueryClient } from "@personal/shared/queries/client";

/**
 * The web app's one server-state cache. It lives at module level so the root
 * route can provide it and tests can clear it between renders.
 */
export const queryClient = createQueryClient();
