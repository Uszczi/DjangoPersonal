/** Render the app through a router backed by in-memory history, seeded at `path`. */
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'

import { routeTree } from '../src/routeTree.gen'

export function renderApp(path = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  const view = render(<RouterProvider router={router} />)

  return { ...view, router }
}
