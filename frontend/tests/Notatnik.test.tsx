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

  test('folders are collapsed until their header is clicked, newest item first', async () => {
    fetchMock.mockImplementation(
      fakeBackend({
        folders: [work],
        boards: [
          board(5, 'Stary plan', 1, '2026-10-10T10:00:00Z', 'markdown'),
          board(6, 'Nowy szkic', 1, '2026-10-20T10:00:00Z'),
          board(7, 'Luźna', null, '2026-10-15T10:00:00Z'),
        ],
      }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    const folder = await screen.findByRole('region', { name: 'Folder: Praca' })
    const toggle = within(folder).getByRole('button', { name: 'Praca' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(folder).queryByRole('button', { name: /^Otwórz/ })).not.toBeInTheDocument()
    // Loose items stay listed below the folders.
    const loose = screen.getByRole('list', { name: 'Tablice' })
    expect(
      within(loose).getAllByRole('button', { name: /^Otwórz/ }).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Otwórz tablicę: Luźna'])

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const items = within(folder).getAllByRole('button', { name: /^Otwórz/ })
    expect(items.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Otwórz tablicę: Nowy szkic',
      'Otwórz notatkę: Stary plan',
    ])
    expect(within(folder).getByRole('button', { name: 'Usuń tablicę: Nowy szkic' })).toBeInTheDocument()

    await user.click(toggle)
    expect(within(folder).queryByRole('button', { name: /^Otwórz/ })).not.toBeInTheDocument()
  })

  test('"+ notatka" in a folder header creates the note in that folder and opens it', async () => {
    const backend = fakeBackend({ folders: [work] })
    fetchMock.mockImplementation(backend)
    const user = userEvent.setup()

    const { router } = renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Nowa notatka w folderze: Praca' }))

    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/whiteboard\/\d+$/))
    const created = (await (await backend('/api/v1/whiteboards/')).json()) as Board[]
    expect(created.map((b) => [b.kind, b.folder_id])).toEqual([['markdown', 1]])
  })

  test('"+ tablica" in a folder header creates the board in that folder', async () => {
    const backend = fakeBackend({ folders: [work] })
    fetchMock.mockImplementation(backend)
    const user = userEvent.setup()

    const { router } = renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Nowa tablica w folderze: Praca' }))

    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(/^\/whiteboard\/\d+$/))
    const created = (await (await backend('/api/v1/whiteboards/')).json()) as Board[]
    expect(created.map((b) => [b.kind, b.folder_id])).toEqual([['whiteboard', 1]])
  })

  test('the browser remembers which folders are expanded', async () => {
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work], boards: [board(5, 'Plan', 1, '2026-10-10T10:00:00Z')] }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Praca' }))
    cleanup()

    renderApp('/whiteboard', { preserveStorage: true })

    expect(await screen.findByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Praca' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('folders still expand when browser storage is unavailable', async () => {
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work], boards: [board(5, 'Plan', 1, '2026-10-10T10:00:00Z')] }),
    )
    const user = userEvent.setup()
    // Only the Notatnik's own key fails, so the rest of the app is unaffected.
    const { getItem: realGet, setItem: realSet } = Storage.prototype
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key.startsWith('notatnik.')) throw new Error('blocked')
      return realGet.call(this, key)
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('notatnik.')) throw new Error('blocked')
      realSet.call(this, key, value)
    })

    try {
      renderApp('/whiteboard')
      await user.click(await screen.findByRole('button', { name: 'Praca' }))
      expect(await screen.findByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  test('"Przenieś do…" moves an item into a folder, between folders and out', async () => {
    const home: Folder = { id: 2, name: 'Dom', created_at: '2026-10-01T10:00:00Z' }
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work, home], boards: [board(5, 'Plan', null, '2026-10-10T10:00:00Z')] }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    const workFolder = await screen.findByRole('region', { name: 'Folder: Praca' })
    const homeFolder = screen.getByRole('region', { name: 'Folder: Dom' })
    await user.click(within(workFolder).getByRole('button', { name: 'Praca' }))
    await user.click(within(homeFolder).getByRole('button', { name: 'Dom' }))
    const loose = screen.getByRole('list', { name: 'Tablice' })

    async function moveTo(target: string, excluded: string) {
      await user.click(screen.getByRole('button', { name: 'Przenieś do…: Plan' }))
      const dialog = await screen.findByRole('dialog', { name: 'Przenieś do…' })
      // The item's current place is not offered.
      expect(within(dialog).queryByRole('button', { name: excluded })).not.toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: target }))
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    await moveTo('Praca', 'Bez folderu')
    expect(within(workFolder).getByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
    expect(within(loose).queryByRole('button', { name: 'Otwórz tablicę: Plan' })).not.toBeInTheDocument()

    await moveTo('Dom', 'Praca')
    expect(within(homeFolder).getByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
    expect(within(workFolder).queryByRole('button', { name: 'Otwórz tablicę: Plan' })).not.toBeInTheDocument()

    await moveTo('Bez folderu', 'Dom')
    expect(within(loose).getByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
    expect(within(homeFolder).queryByRole('button', { name: 'Otwórz tablicę: Plan' })).not.toBeInTheDocument()
  })
})
