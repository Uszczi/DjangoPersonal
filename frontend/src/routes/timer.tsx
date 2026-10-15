import { createFileRoute } from '@tanstack/react-router'

import TimerPage from '../TimerPage'

export const Route = createFileRoute('/timer')({
  component: TimerPage,
})
