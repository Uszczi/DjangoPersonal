/** User-visible Folder flows in the Notatnik, against a small in-memory fake of the API. */

import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

vi.mock('@/components/WhiteboardCanvas', () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}))

type Folder = { id: number; name: string; created_at: string }
type Board = {
  id: number
  kind: 'whiteboard' | 'markdown'
  name: string
  folder_id: number | null
  content: Record<string, unknown>
  created_at: string
  updated_at: string
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Answers the folders and whiteboards endpoints the way the backend does. */
function fakeBackend(initial: { folders?: Folder[]; boards?: Board[] } = {}) {
  const folders = (initial.folders ?? []).map((f) => ({ ...f }))
  let boards = (initial.boards ?? []).map((b) => ({ ...b }))
  let nextId = 100
  let clock = Date.parse('2026-10-25T12:00:00Z')
  const now = () => new Date((clock += 1000)).toISOString()

  function nameTaken(name: string, except?: number) {
    return folders.some((f) => f.id !== except && f.name.toLowerCase() === name.trim().toLowerCase())
  }
  const duplicate = () => jsonResponse({ detail: 'A folder with this name already exists.' }, 400)

  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : {}

    if (path.endsWith('/folders/')) {
      if (method === 'POST') {
        if (nameTaken(body.name)) return duplicate()
        const folder = { id: nextId++, name: body.name.trim(), created_at: now() }
        folders.push(folder)
        return jsonResponse(folder, 201)
      }
      return jsonResponse(
        [...folders].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      )
    }
    const folderMatch = path.match(/\/folders\/(\d+)\/$/)
    if (folderMatch) {
      const folder = folders.find((f) => f.id === Number(folderMatch[1]))
      if (!folder) return jsonResponse({ detail: 'Folder not found.' }, 404)
      if (method === 'DELETE') {
        folders.splice(folders.indexOf(folder), 1)
        boards = boards.filter((b) => b.folder_id !== folder.id)
        return jsonResponse(null, 204)
      }
      if (body.name !== undefined && nameTaken(body.name, folder.id)) return duplicate()
      if (body.name !== undefined) folder.name = body.name.trim()
      return jsonResponse(folder)
    }

    if (path.endsWith('/whiteboards/')) {
      if (method === 'POST') {
        const board: Board = {
          id: nextId++,
          kind: body.kind ?? 'whiteboard',
          name: body.name ?? 'Bez tytułu',
          folder_id: body.folder_id ?? null,
          content: body.kind === 'markdown' ? { markdown: '' } : { version: 1, elements: [], viewport: { x: 0, y: 0, zoom: 1 } },
          created_at: now(),
          updated_at: now(),
        }
        boards.push(board)
        return jsonResponse(board, 201)
      }
      return jsonResponse([...boards].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)))
    }
    const boardMatch = path.match(/\/whiteboards\/(\d+)\/$/)
    if (boardMatch) {
      const board = boards.find((b) => b.id === Number(boardMatch[1]))
      if (!board) return jsonResponse({ detail: 'Whiteboard not found.' }, 404)
      if (method === 'DELETE') {
        boards = boards.filter((b) => b !== board)
        return jsonResponse(null, 204)
      }
      if (method === 'PATCH') Object.assign(board, body, { updated_at: now() })
      return jsonResponse(board)
    }

    if (path.includes('/timer/')) return jsonResponse({ entry: null, server_now: '2026-10-25T12:00:00Z' })
    return jsonResponse([])
  }
}

const work: Folder = { id: 1, name: 'Praca', created_at: '2026-10-01T10:00:00Z' }

function board(id: number, name: string, folderId: number | null, updatedAt: string, kind: Board['kind'] = 'whiteboard'): Board {
  return {
    id,
    kind,
    name,
    folder_id: folderId,
    content: {},
    created_at: '2026-10-01T10:00:00Z',
    updated_at: updatedAt,
  }
}

describe('Notatnik folders', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('user can create a folder and it is listed alphabetically above loose items', async () => {
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work], boards: [board(5, 'Szkic', null, '2026-10-20T10:00:00Z')] }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await screen.findByRole('region', { name: 'Folder: Praca' })

    await user.click(screen.getByRole('button', { name: 'Nowy folder' }))
    await user.type(await screen.findByLabelText('Nazwa folderu'), 'Archiwum')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))

    await screen.findByRole('region', { name: 'Folder: Archiwum' })
    const folderNames = screen
      .getAllByRole('region', { name: /^Folder: / })
      .map((region) => region.getAttribute('aria-label'))
    expect(folderNames).toEqual(['Folder: Archiwum', 'Folder: Praca'])
    expect(screen.getByRole('button', { name: 'Otwórz tablicę: Szkic' })).toBeInTheDocument()
  })

  test('a duplicate folder name is shown as an error', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await screen.findByRole('region', { name: 'Folder: Praca' })

    await user.click(screen.getByRole('button', { name: 'Nowy folder' }))
    await user.type(await screen.findByLabelText('Nazwa folderu'), 'praca')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))

    expect(await screen.findByText('A folder with this name already exists.')).toBeInTheDocument()
  })

  test('the pencil renames a folder', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Zmień nazwę folderu: Praca' }))
    const input = await screen.findByLabelText('Nazwa folderu')
    await user.clear(input)
    await user.type(input, 'Dom')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByRole('region', { name: 'Folder: Dom' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Folder: Praca' })).not.toBeInTheDocument()
  })

  test('a folder alone is not the empty state', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))

    renderApp('/whiteboard')

    expect(await screen.findByRole('region', { name: 'Folder: Praca' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Utwórz pierwszą notatkę' })).not.toBeInTheDocument()
  })

  test('the empty state offers a new folder too', async () => {
    fetchMock.mockImplementation(fakeBackend())
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await screen.findByRole('heading', { name: 'Utwórz pierwszą notatkę' })

    // The page header and the empty state both offer it.
    await user.click(screen.getAllByRole('button', { name: 'Nowy folder' })[1])
    await user.type(await screen.findByLabelText('Nazwa folderu'), 'Praca')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))

    expect(await screen.findByRole('region', { name: 'Folder: Praca' })).toBeInTheDocument()
    expect(within(document.body).queryByRole('heading', { name: 'Utwórz pierwszą notatkę' })).not.toBeInTheDocument()
  })
})
