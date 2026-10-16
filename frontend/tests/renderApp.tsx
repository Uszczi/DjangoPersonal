/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'

import { routeTree } from '../src/routeTree.gen'
import { useLayoutStore } from '../src/stores/layout'
import { useModalStore } from '../src/stores/modal'
import { useProjectsStore } from '../src/stores/projects'
import { useTasksStore } from '../src/stores/tasks'
import { useTimerStore } from '../src/stores/timer'

/** Reset every Zustand store so each render starts from a clean slate. */
export function resetStores() {
  window.localStorage.clear()
  useLayoutStore.setState(useLayoutStore.getInitialState())
  useModalStore.setState(useModalStore.getInitialState())
  useProjectsStore.setState(useProjectsStore.getInitialState())
  useTasksStore.setState(useTasksStore.getInitialState())
  useTimerStore.setState(useTimerStore.getInitialState())
}

export function renderApp(path = '/') {
  resetStores()

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  const view = render(<RouterProvider router={router} />)

  return { ...view, router }
}
