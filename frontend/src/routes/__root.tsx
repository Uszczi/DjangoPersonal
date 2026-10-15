import { createRootRoute, retainSearchParams } from '@tanstack/react-router'

import App from '../App'

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { project?: number } => ({
    project: typeof search.project === 'number' ? search.project : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(['project'])],
  },
  component: App,
})
