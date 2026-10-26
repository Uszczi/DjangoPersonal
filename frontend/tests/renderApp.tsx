/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'

import { queryClient } from '@/queryClient'
import { routeTree } from '@/routeTree.gen'
import { useAuthStore } from '@personal/shared/stores/auth'
import { useCategoriesStore } from '@personal/shared/stores/categories'
import { useCountersStore } from '@personal/shared/stores/counters'
import { useLayoutStore } from '@/stores/layout'
import { useModalStore } from '@/stores/modal'
import { useProjectsStore } from '@personal/shared/stores/projects'
import { useTasksStore } from '@personal/shared/stores/tasks'
import { useTimerStore } from '@personal/shared/stores/timer'
import { useTransactionsStore } from '@personal/shared/stores/transactions'
import { useWalletsStore } from '@personal/shared/stores/wallets'
import { useWhiteboardsStore } from '@/stores/whiteboards'
import { useFoldersStore } from '@/stores/folders'

/**
 * Reset every Zustand store so each render starts from a clean slate. Browser storage is
 * cleared too unless `preserveStorage`, for tests of what a page remembers between visits.
 */
export function resetStores(options?: { preserveStorage?: boolean }) {
  if (!options?.preserveStorage) window.localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState())
  useCategoriesStore.setState(useCategoriesStore.getInitialState())
  useCountersStore.setState(useCountersStore.getInitialState())
  useLayoutStore.setState(useLayoutStore.getInitialState())
  useModalStore.setState(useModalStore.getInitialState())
  useProjectsStore.setState(useProjectsStore.getInitialState())
  useTasksStore.setState(useTasksStore.getInitialState())
  useTimerStore.setState(useTimerStore.getInitialState())
  useTransactionsStore.setState(useTransactionsStore.getInitialState())
  useWalletsStore.setState(useWalletsStore.getInitialState())
  useWhiteboardsStore.setState(useWhiteboardsStore.getInitialState())
  useFoldersStore.setState(useFoldersStore.getInitialState())
  // The server-state cache too; no retries, so a mocked failure shows at once.
  queryClient.clear()
  queryClient.setDefaultOptions({ queries: { retry: false } })
}

export function renderApp(
  path = '/',
  options?: { authenticated?: boolean; preserveStorage?: boolean },
) {
  resetStores({ preserveStorage: options?.preserveStorage })

  if (options?.authenticated !== false) {
    useAuthStore.setState({
      user: { id: 1, username: 'testuser' },
      access: 'test-access-token',
      refresh: 'test-refresh-token',
    })
  }

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  const view = render(<RouterProvider router={router} />)

  return { ...view, router }
}
