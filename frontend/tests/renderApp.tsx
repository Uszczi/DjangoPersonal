/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'

import { routeTree } from '@/routeTree.gen'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import { useLayoutStore } from '@/stores/layout'
import { useModalStore } from '@/stores/modal'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useTransactionsStore } from '@/stores/transactions'
import { useWalletsStore } from '@/stores/wallets'
import { useWhiteboardsStore } from '@/stores/whiteboards'

/** Reset every Zustand store so each render starts from a clean slate. */
export function resetStores() {
  window.localStorage.clear()
  useAuthStore.setState(useAuthStore.getInitialState())
  useCategoriesStore.setState(useCategoriesStore.getInitialState())
  useLayoutStore.setState(useLayoutStore.getInitialState())
  useModalStore.setState(useModalStore.getInitialState())
  useProjectsStore.setState(useProjectsStore.getInitialState())
  useTasksStore.setState(useTasksStore.getInitialState())
  useTimerStore.setState(useTimerStore.getInitialState())
  useTransactionsStore.setState(useTransactionsStore.getInitialState())
  useWalletsStore.setState(useWalletsStore.getInitialState())
  useWhiteboardsStore.setState(useWhiteboardsStore.getInitialState())
}

export function renderApp(path = '/', options?: { authenticated?: boolean }) {
  resetStores()

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
