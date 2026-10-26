import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from '../renderApp'

vi.mock('@/components/WhiteboardCanvas', () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}))

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
    expect(await screen.findByRole('heading', { name: 'Utwórz pierwszą notatkę' })).toBeInTheDocument()
  })

  test('the section is called Notatnik', async () => {
    renderApp('/whiteboard')
    expect(await screen.findByRole('heading', { name: 'Notatnik' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Notatnik' }).length).toBeGreaterThan(0)
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
    expect(await screen.findByRole('heading', { name: 'Bez tytułu' })).toBeInTheDocument()
    expect(screen.getByText('Zapisano')).toBeInTheDocument()
  })

  test('a rename the server refuses shows why and keeps the old name', async () => {
    const detail = 'A whiteboard or note with this name already exists in this folder.'
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      if (url.includes('/api/v1/whiteboards/5/')) {
        if (method === 'PATCH') return Promise.resolve(jsonResponse({ detail }, 400))
        return Promise.resolve(jsonResponse(wb))
      }
      if (url.startsWith('/api/v1/timer/')) return Promise.resolve(jsonResponse({ entry: null, server_now: '2026-10-15T12:00:00Z' }))
      return Promise.resolve(jsonResponse([]))
    })
    const user = userEvent.setup()
    renderApp('/whiteboard/5')

    await user.click(await screen.findByRole('button', { name: 'Kliknij, aby zmienić nazwę' }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Plan{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(detail)
    expect(screen.getByRole('heading', { name: 'Bez tytułu' })).toBeInTheDocument()
    const patches = fetchMock.mock.calls.filter(([input, init]) => (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'PATCH')
    expect(patches).toHaveLength(1)
  })

  describe('the Notatnik tree beside an open item', () => {
    const folder = { id: 1, name: 'Praca', parent_id: null, created_at: wb.created_at, updated_at: wb.updated_at }
    const inFolder = { ...wb, id: 5, name: 'Plan', kind: 'markdown', folder_id: 1, content: { markdown: '# Plan' } }
    const loose = { ...wb, id: 6, name: 'Luźna', kind: 'markdown', folder_id: null, content: { markdown: 'Luźna treść' } }

    beforeEach(() => {
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = requestUrl(input)
        if (url.includes('/api/v1/whiteboards/5/')) return Promise.resolve(jsonResponse(inFolder))
        if (url.includes('/api/v1/whiteboards/6/')) return Promise.resolve(jsonResponse(loose))
        if (url.startsWith('/api/v1/whiteboards/')) return Promise.resolve(jsonResponse([inFolder, loose]))
        if (url.startsWith('/api/v1/folders/')) return Promise.resolve(jsonResponse([folder]))
        if (url.startsWith('/api/v1/timer/')) return Promise.resolve(jsonResponse({ entry: null, server_now: '2026-10-15T12:00:00Z' }))
        return Promise.resolve(jsonResponse([]))
      })
    })

    test('reveals the open Notatka in its Folder and opens another on the right', async () => {
      const user = userEvent.setup()
      renderApp('/whiteboard/5')

      const tree = await screen.findByRole('complementary', { name: 'Drzewo Notatnika' })
      expect(await within(tree).findByRole('button', { name: 'Otwórz notatkę: Plan' })).toHaveAttribute('aria-current', 'page')
      expect(within(tree).getByRole('button', { name: 'Praca' })).toHaveAttribute('aria-expanded', 'true')

      await user.click(within(tree).getByRole('button', { name: 'Otwórz notatkę: Luźna' }))

      expect(await screen.findByRole('heading', { name: 'Luźna' })).toBeInTheDocument()
      expect(within(tree).getByRole('button', { name: 'Otwórz notatkę: Luźna' })).toHaveAttribute('aria-current', 'page')
    })

    test('a Notatka opens in the highlighted mode', async () => {
      renderApp('/whiteboard/5')
      expect(await screen.findByRole('button', { name: 'Podświetlony' })).toHaveAttribute('aria-pressed', 'true')
    })

    test('the highlighted and editable modes share one field', async () => {
      const user = userEvent.setup()
      renderApp('/whiteboard/5')

      const field = await screen.findByDisplayValue('# Plan')
      await user.click(screen.getByRole('button', { name: 'Edycja' }))

      expect(screen.getByRole('button', { name: 'Edycja' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByDisplayValue('# Plan')).toBe(field)
    })

    test('searches the open Notatka and steps through the matches', async () => {
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = requestUrl(input)
        if (url.includes('/api/v1/whiteboards/5/')) return Promise.resolve(jsonResponse({ ...inFolder, content: { markdown: 'plan A\nPlan B\nreszta' } }))
        if (url.startsWith('/api/v1/whiteboards/')) return Promise.resolve(jsonResponse([inFolder, loose]))
        if (url.startsWith('/api/v1/folders/')) return Promise.resolve(jsonResponse([folder]))
        if (url.startsWith('/api/v1/timer/')) return Promise.resolve(jsonResponse({ entry: null, server_now: '2026-10-15T12:00:00Z' }))
        return Promise.resolve(jsonResponse([]))
      })
      const user = userEvent.setup()
      renderApp('/whiteboard/5')

      const field = await screen.findByDisplayValue(/plan A/)
      field.focus()
      await user.keyboard('{Control>}f{/Control}')
      const search = await screen.findByRole('searchbox', { name: 'Szukaj w notatce' })
      await waitFor(() => expect(search).toHaveFocus())
      await user.type(search, 'plan')

      expect(screen.getByText('1 z 2')).toBeInTheDocument()
      await user.keyboard('{Enter}')
      expect(screen.getByText('2 z 2')).toBeInTheDocument()
      expect((field as HTMLTextAreaElement).selectionStart).toBe(7)
      await user.click(screen.getByRole('button', { name: 'Następne trafienie' }))
      expect(screen.getByText('1 z 2')).toBeInTheDocument()

      await user.clear(search)
      await user.type(search, 'xyz')
      expect(screen.getByText('Brak wyników')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('searchbox', { name: 'Szukaj w notatce' })).not.toBeInTheDocument()
      expect(field).toHaveFocus()
    })

    test('the tree is on the Notatnik page too', async () => {
      renderApp('/whiteboard')
      const tree = await screen.findByRole('complementary', { name: 'Drzewo Notatnika' })
      expect(await within(tree).findByRole('button', { name: 'Otwórz notatkę: Luźna' })).not.toHaveAttribute('aria-current')
      expect(within(tree).getByRole('searchbox', { name: 'Szukaj w Notatniku' })).toBeInTheDocument()
      expect(screen.getByText(/Wybierz notatkę lub tablicę/)).toBeInTheDocument()
    })

    test('the tree collapses and expands', async () => {
      const user = userEvent.setup()
      renderApp('/whiteboard/5')

      await user.click(await screen.findByRole('button', { name: 'Zwiń drzewo Notatnika' }))
      expect(screen.queryByRole('searchbox', { name: 'Szukaj w Notatniku' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Rozwiń drzewo Notatnika' }))
      expect(screen.getByRole('searchbox', { name: 'Szukaj w Notatniku' })).toBeInTheDocument()
    })
  })
})
