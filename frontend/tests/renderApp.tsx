/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";

import { queryClient } from "@/queryClient";
import { routeTree } from "@/routeTree.gen";
import type { UserSettingsResponse } from "@personal/shared/generated/api";
import { settingsKeys } from "@personal/shared/queries/keys";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";
import { useCounterViewStore } from "@personal/shared/stores/counterView";
import { useNewTaskStatusStore } from "@personal/shared/stores/newTaskStatus";
import { useThemeStore } from "@personal/shared/stores/theme";
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
  useThemeStore.setState(useThemeStore.getInitialState());
  useNewTaskStatusStore.setState(useNewTaskStatusStore.getInitialState());
  useBibliographyViewStore.setState(useBibliographyViewStore.getInitialState());
  useCounterViewStore.setState(useCounterViewStore.getInitialState());
  // No retries, so a mocked failure shows at once; the app's other defaults
  // (such as how long data stays fresh) stay as they are.
  queryClient.clear();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false },
  });
}

/**
 * `settings` seeds the account's settings, which the root route loads for
 * every signed-in page, so tests of other pages need not answer
 * `/api/v1/settings/`; pass `null` to leave them to the (mocked) server.
 */
export function renderApp(
  path = "/",
  options?: {
    authenticated?: boolean;
    preserveStorage?: boolean;
    settings?: UserSettingsResponse | null;
  },
) {
  resetStores({ preserveStorage: options?.preserveStorage });

  if (options?.authenticated !== false) {
    useAuthStore.setState({
      user: { id: 1, username: "testuser" },
      access: "test-access-token",
      refresh: "test-refresh-token",
    });
    const settings =
      options?.settings === undefined
        ? { theme: useThemeStore.getState().preference }
        : options.settings;
    if (settings) queryClient.setQueryData(settingsKeys.all, settings);
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const view = render(<RouterProvider router={router} />);

  return { ...view, router };
}
