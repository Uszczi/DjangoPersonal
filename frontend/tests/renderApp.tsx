/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";

import { queryClient } from "@/queryClient";
import { routeTree } from "@/routeTree.gen";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useWalletSelectionStore } from "@personal/shared/stores/walletSelection";
import { useLayoutStore } from "@/stores/layout";
import { useModalStore } from "@/stores/modal";
import { useProjectSelectionStore } from "@/stores/projectSelection";

/**
 * Reset every Zustand store and the server-state cache so each render starts from a clean slate. Browser storage is
 * cleared too unless `preserveStorage`, for tests of what a page remembers between visits.
 */
export function resetStores(options?: { preserveStorage?: boolean }) {
  if (!options?.preserveStorage) window.localStorage.clear();
  useAuthStore.setState(useAuthStore.getInitialState());
  useLayoutStore.setState(useLayoutStore.getInitialState());
  useModalStore.setState(useModalStore.getInitialState());
  useProjectSelectionStore.setState(useProjectSelectionStore.getInitialState());
  useWalletSelectionStore.setState(useWalletSelectionStore.getInitialState());
  // No retries, so a mocked failure shows at once; the app's other defaults
  // (such as how long data stays fresh) stay as they are.
  queryClient.clear();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false },
  });
}

export function renderApp(
  path = "/",
  options?: { authenticated?: boolean; preserveStorage?: boolean },
) {
  resetStores({ preserveStorage: options?.preserveStorage });

  if (options?.authenticated !== false) {
    useAuthStore.setState({
      user: { id: 1, username: "testuser" },
      access: "test-access-token",
      refresh: "test-refresh-token",
    });
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const view = render(<RouterProvider router={router} />);

  return { ...view, router };
}
