import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

const wb = {
  id: 5,
  name: 'Bez tytułu',
  content: { version: 1, elements: [], viewport: { x: 0, y: 0, zoom: 1 } },
  created_at: '2026-10-18T10:00:00Z',
  updated_at: '2026-10-18T10:00:00Z',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return (input as Request).url
}

describe('Whiteboard', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.startsWith('/api/v1/whiteboards/')) {
        if (url.includes('/5/')) return Promise.resolve(jsonResponse(wb))
        return Promise.resolve(jsonResponse([]))
      }
      if (url.startsWith('/api/v1/projects/')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/v1/tasks/')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/v1/timer/')) return Promise.resolve(jsonResponse({ entry: null, server_now: '2026-10-15T12:00:00Z' }))
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('empty list shows empty state', async () => {
    renderApp('/whiteboard')
    expect(await screen.findByRole('heading', { name: 'Utwórz pierwszą tablicę' })).toBeInTheDocument()
  })

  test('not-found page for missing whiteboard', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.includes('/api/v1/whiteboards/999/')) {
        return Promise.resolve(jsonResponse({ detail: 'Whiteboard not found.' }, 404))
      }
      if (url.startsWith('/api/v1/whiteboards/')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/v1/projects/')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/v1/tasks/')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/v1/timer/')) return Promise.resolve(jsonResponse({ entry: null, server_now: '2026-10-15T12:00:00Z' }))
      return Promise.resolve(jsonResponse([]))
    })
    renderApp('/whiteboard/999')
    expect(await screen.findByRole('heading', { name: 'Tej strony nie ma' })).toBeInTheDocument()
  })

  test('opening a whiteboard shows save state', async () => {
    renderApp('/whiteboard/5')
    expect(await screen.findByRole('heading', { name: 'Tablica' })).toBeInTheDocument()
    expect(screen.getByText('Zapisano')).toBeInTheDocument()
  })
})
