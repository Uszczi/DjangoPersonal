import { createContext, useContext } from 'react'

import type { Project } from './generated/api'

export type LayoutContext = {
  projects: Project[]
  selectedProjectId: number | null
  isLoading: boolean
  onNewProject: () => void
  onEditProject: (project: Project) => void
  onDeleteProject: (project: Project) => void
}

export const LayoutContextValue = createContext<LayoutContext | null>(null)

export function useLayoutContext() {
  const value = useContext(LayoutContextValue)
  if (!value) {
    throw new Error('useLayoutContext must be used within the app layout.')
  }
  return value
}
