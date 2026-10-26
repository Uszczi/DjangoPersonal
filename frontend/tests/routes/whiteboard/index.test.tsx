/** User-visible Folder flows in the Notatnik, against a small in-memory fake of the API. */

import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from '../../renderApp'

vi.mock('@/components/WhiteboardCanvas', () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}))

type Folder = { id: number; name: string; parent_id?: number | null; created_at: string }
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
const searches: string[] = []

function fakeBackend(initial: { folders?: Folder[]; boards?: Board[] } = {}) {
  let folders = (initial.folders ?? []).map((f) => ({ parent_id: null, ...f }))
  let boards = (initial.boards ?? []).map((b) => ({ ...b }))
  let nextId = 100
  let clock = Date.parse('2026-10-25T12:00:00Z')
  const now = () => new Date((clock += 1000)).toISOString()

  function nameTaken(name: string, parentId: number | null, except?: number) {
    return folders.some(
      (f) => f.id !== except && f.parent_id === parentId && f.name === name.trim(),
    )
  }
  function subtree(id: number) {
    const ids = new Set([id])
    for (let grew = true; grew; ) {
      grew = false
      for (const f of folders) {
        if (f.parent_id != null && ids.has(f.parent_id) && !ids.has(f.id)) {
          ids.add(f.id)
          grew = true
        }
      }
    }
    return ids
  }
  const duplicate = () => jsonResponse({ detail: 'A folder with this name already exists.' }, 400)
  /** A rough stand-in for the server's grep: lowercase, Polish letters folded. */
  const key = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/ł/gi, 'l').toLowerCase()
  function search(q: string) {
    const words = key(q).split(/\s+/).filter(Boolean)
    const hits = (text: string) => words.every((w) => key(text).includes(w))
    return boards.flatMap(({ content, ...b }) => {
      const markdown = b.kind === 'markdown' && typeof content.markdown === 'string' ? content.markdown : ''
      const lines = markdown
        .split('\n')
        .map((text, i) => ({ number: i + 1, text: text.trim() }))
        .filter((line) => hits(line.text))
      return lines.length > 0 || hits(b.name) ? [{ ...b, lines }] : []
    })
  }

  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : {}

    if (path.includes('/whiteboards/search/')) {
      searches.push(new URL(path, 'http://x').searchParams.get('q') ?? '')
      return jsonResponse(search(new URL(path, 'http://x').searchParams.get('q') ?? ''))
    }
    if (path.endsWith('/folders/')) {
      if (method === 'POST') {
        const parentId = body.parent_id ?? null
        if (nameTaken(body.name, parentId)) return duplicate()
        const folder = { id: nextId++, name: body.name.trim(), parent_id: parentId, created_at: now() }
        folders.push(folder)
        return jsonResponse(folder, 201)
      }
      return jsonResponse(
        [...folders].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id)),
      )
    }
    const folderMatch = path.match(/\/folders\/(\d+)\/$/)
    if (folderMatch) {
      const folder = folders.find((f) => f.id === Number(folderMatch[1]))
      if (!folder) return jsonResponse({ detail: 'Folder not found.' }, 404)
      if (method === 'DELETE') {
        const removed = subtree(folder.id)
        folders = folders.filter((f) => !removed.has(f.id))
        boards = boards.filter((b) => b.folder_id == null || !removed.has(b.folder_id))
        return jsonResponse(null, 204)
      }
      const parentId = body.parent_id !== undefined ? body.parent_id : folder.parent_id
      if (parentId != null && subtree(folder.id).has(parentId)) {
        return jsonResponse({ detail: 'A folder cannot be moved into itself or one of its subfolders.' }, 400)
      }
      if (nameTaken(body.name ?? folder.name, parentId, folder.id)) return duplicate()
      folder.parent_id = parentId
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

describe('Notatnik search', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    searches.length = 0
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const projects: Folder = { id: 2, name: 'Projekty', parent_id: 1, created_at: '2026-10-01T10:00:00Z' }

  test('finds items and folders at any depth, ignoring case and Polish letters, with their path', async () => {
    fetchMock.mockImplementation(
      fakeBackend({
        folders: [work, projects],
        boards: [
          board(5, 'Żółw szkic', 2, '2026-10-20T10:00:00Z', 'markdown'),
          board(6, 'Zakupy', null, '2026-10-19T10:00:00Z'),
        ],
      }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'zolw')

    const results = await screen.findByRole('list', { name: 'Wyniki wyszukiwania' })
    const hit = await within(results).findByRole('button', { name: 'Otwórz notatkę: Żółw szkic' })
    expect(hit).toHaveTextContent('Praca / Projekty')
    expect(within(results).queryByRole('button', { name: 'Otwórz tablicę: Zakupy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Folder: Praca' })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'proj')
    expect(screen.getByRole('button', { name: 'Pokaż folder: Projekty' })).toHaveTextContent('Praca')
  })

  test('asks the server for Notatki matching their text and shows the lines with their numbers', async () => {
    const note = board(5, 'Dziennik', 2, '2026-10-20T10:00:00Z', 'markdown')
    note.content = { markdown: '# Poniedziałek\nKupić mleko\nZadzwonić do Żanety\nmleko owsiane, nie krowie' }
    const drawing = board(6, 'Szkic', null, '2026-10-19T10:00:00Z')
    drawing.content = { version: 1, elements: [{ type: 'note', text: 'mleko' }] }
    fetchMock.mockImplementation(fakeBackend({ folders: [work, projects], boards: [note, drawing] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'MLEKO')

    const results = await screen.findByRole('list', { name: 'Wyniki wyszukiwania' })
    const hit = await within(results).findByRole('button', { name: 'Otwórz notatkę: Dziennik' })
    // One request once typing pauses, not one per keystroke.
    expect(searches).toEqual(['MLEKO'])
    expect(hit).toHaveTextContent('Praca / Projekty')
    const lines = within(hit).getByRole('list', { name: 'Pasujące linie' })
    expect(within(lines).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '2Kupić mleko',
      '4mleko owsiane, nie krowie',
    ])
    expect(within(results).queryByRole('button', { name: 'Otwórz tablicę: Szkic' })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'zanet zadzwon')
    expect(
      await within(await screen.findByRole('list', { name: 'Pasujące linie' })).findByText('Zadzwonić do Żanety'),
    ).toBeInTheDocument()
  })

  test('a Notatka found by its text opens with its own search already showing the query', async () => {
    const note = board(5, 'Dziennik', null, '2026-10-20T10:00:00Z', 'markdown')
    note.content = { markdown: 'Zadzwonić do Żanety\nnic\nżaneta oddzwoni' }
    fetchMock.mockImplementation(fakeBackend({ boards: [note] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'zanet')
    const results = await screen.findByRole('list', { name: 'Wyniki wyszukiwania' })
    await user.click(await within(results).findByRole('button', { name: 'Otwórz notatkę: Dziennik' }))

    expect(await screen.findByRole('searchbox', { name: 'Szukaj w notatce' })).toHaveValue('zanet')
    // Ignoring case and Polish letters, like the Notatnik search.
    expect(screen.getByText('1 z 2')).toBeInTheDocument()

    // The preview marks the same matches.
    await user.click(screen.getByRole('button', { name: 'Podgląd' }))
    expect(screen.getByRole('searchbox', { name: 'Szukaj w notatce' })).toHaveValue('zanet')
    expect(screen.getAllByText((_, el) => el?.tagName === 'MARK' && el.closest('pre') === null).map((m) => m.textContent)).toEqual(['Żanet', 'żanet'])
  })

  test('shows the first three matching lines and how many more there are', async () => {
    const note = board(5, 'Lista', null, '2026-10-20T10:00:00Z', 'markdown')
    note.content = { markdown: ['kawa 1', 'kawa 2', 'herbata', 'kawa 3', 'kawa 4', 'kawa 5'].join('\n') }
    fetchMock.mockImplementation(fakeBackend({ boards: [note] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'kawa')

    const lines = await screen.findByRole('list', { name: 'Pasujące linie' })
    expect(within(lines).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1kawa 1', '2kawa 2', '4kawa 3'])
    expect(lines).toHaveTextContent('i 2 więcej')
  })

  test('says so when the search fails', async () => {
    const backend = fakeBackend({ folders: [work] })
    fetchMock.mockImplementation((url: string | URL | Request, init?: RequestInit) =>
      String(url).includes('/whiteboards/search/') ? Promise.resolve(jsonResponse({}, 500)) : backend(url, init),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'cokolwiek')
    expect(await screen.findByText('Nie udało się przeszukać Notatnika.')).toBeInTheDocument()
  })

  test('says when nothing matches, and Escape brings the tree back', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    const search = await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' })
    await user.type(search, 'xyz')
    expect(await screen.findByText('Nic nie pasuje do „xyz”.')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(screen.getByRole('region', { name: 'Folder: Praca' })).toBeInTheDocument()
  })

  test('picking a folder result shows it in the tree with its parents expanded', async () => {
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work, projects], boards: [board(5, 'Plan', 2, '2026-10-20T10:00:00Z')] }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.type(await screen.findByRole('searchbox', { name: 'Szukaj w Notatniku' }), 'Projekty')
    await user.click(screen.getByRole('button', { name: 'Pokaż folder: Projekty' }))

    expect(screen.getByRole('button', { name: 'Praca' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Projekty' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
  })
})

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
    await user.type(await screen.findByLabelText('Nazwa folderu'), 'Praca')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))

    expect(await screen.findByText('A folder with this name already exists.')).toBeInTheDocument()
  })

  test('a folder name with a space or "/" is refused before it is sent', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await screen.findByRole('region', { name: 'Folder: Praca' })
    await user.click(screen.getByRole('button', { name: 'Nowy folder' }))
    const input = await screen.findByLabelText('Nazwa folderu')

    for (const name of ['Klient A', 'Praca/2026']) {
      await user.clear(input)
      await user.type(input, name)
      await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Nazwa folderu nie może zawierać spacji ani „/”.')
    }
    const posts = fetchMock.mock.calls.filter(([input, init]) => (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'POST')
    expect(posts).toHaveLength(0)
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

  test.each([
    [0, 'Usunąć folder „Praca”?'],
    [1, 'Usunąć folder „Praca” i 1 element w nim?'],
    [3, 'Usunąć folder „Praca” i 3 elementy w nim?'],
    [5, 'Usunąć folder „Praca” i 5 elementów w nim?'],
    [12, 'Usunąć folder „Praca” i 12 elementów w nim?'],
    [22, 'Usunąć folder „Praca” i 22 elementy w nim?'],
  ])('deleting a folder with %i items asks “%s”', async (count, question) => {
    const items = Array.from({ length: count }, (_, i) => board(10 + i, `Plan ${i}`, 1, '2026-10-10T10:00:00Z'))
    fetchMock.mockImplementation(fakeBackend({ folders: [work], boards: items }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Usuń folder: Praca' }))

    expect(await screen.findByRole('dialog', { name: question })).toBeInTheDocument()
  })

  test('cancelling a folder delete keeps everything', async () => {
    fetchMock.mockImplementation(
      fakeBackend({ folders: [work], boards: [board(5, 'Plan', 1, '2026-10-10T10:00:00Z')] }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Usuń folder: Praca' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Anuluj' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Praca' }))
    expect(screen.getByRole('button', { name: 'Otwórz tablicę: Plan' })).toBeInTheDocument()
  })

  test('confirming deletes the folder and its items but not loose ones', async () => {
    fetchMock.mockImplementation(
      fakeBackend({
        folders: [work],
        boards: [board(5, 'Plan', 1, '2026-10-10T10:00:00Z'), board(6, 'Luźna', null, '2026-10-11T10:00:00Z')],
      }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Usuń folder: Praca' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Usuń folder' }))

    await vi.waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Folder: Praca' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Otwórz tablicę: Plan' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Otwórz tablicę: Luźna' })).toBeInTheDocument()
  })

  test('"Nowy folder w folderze" creates a subfolder shown inside its parent', async () => {
    fetchMock.mockImplementation(fakeBackend({ folders: [work] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Nowy folder w folderze: Praca' }))
    expect(await screen.findByRole('dialog', { name: 'Nowy folder w „Praca”' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nazwa folderu'), 'Klient-A')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // Only top-level folders show while the parent is collapsed.
    expect(screen.queryByRole('region', { name: 'Folder: Klient-A' })).not.toBeInTheDocument()
    const parent = screen.getByRole('region', { name: 'Folder: Praca' })
    await user.click(within(parent).getByRole('button', { name: 'Praca' }))
    expect(within(parent).getByRole('region', { name: 'Folder: Klient-A' })).toBeInTheDocument()
  })

  test('a subfolder may share a name with a folder elsewhere', async () => {
    const home: Folder = { id: 2, name: 'Dom', created_at: '2026-10-01T10:00:00Z' }
    const notes: Folder = { id: 3, name: 'Notatki', parent_id: 1, created_at: '2026-10-01T10:00:00Z' }
    fetchMock.mockImplementation(fakeBackend({ folders: [work, home, notes] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Nowy folder w folderze: Dom' }))
    await user.type(await screen.findByLabelText('Nazwa folderu'), 'Notatki')
    await user.click(screen.getByRole('button', { name: 'Utwórz folder' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('a folder moves into another one but never into itself or below itself', async () => {
    const home: Folder = { id: 2, name: 'Dom', created_at: '2026-10-01T10:00:00Z' }
    const client: Folder = { id: 3, name: 'Klient', parent_id: 1, created_at: '2026-10-01T10:00:00Z' }
    fetchMock.mockImplementation(fakeBackend({ folders: [work, home, client] }))
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Przenieś folder do…: Praca' }))
    const dialog = await screen.findByRole('dialog', { name: 'Przenieś do…' })
    expect(within(dialog).queryByRole('button', { name: 'Praca' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Praca / Klient' })).not.toBeInTheDocument()
    // Already at the top level.
    expect(within(dialog).queryByRole('button', { name: 'Bez folderu' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Dom' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const homeFolder = screen.getByRole('region', { name: 'Folder: Dom' })
    await user.click(within(homeFolder).getByRole('button', { name: 'Dom' }))
    expect(within(homeFolder).getByRole('region', { name: 'Folder: Praca' })).toBeInTheDocument()
  })

  test('deleting a folder counts and removes what is in its subfolders', async () => {
    const client: Folder = { id: 3, name: 'Klient', parent_id: 1, created_at: '2026-10-01T10:00:00Z' }
    fetchMock.mockImplementation(
      fakeBackend({
        folders: [work, client],
        boards: [
          board(5, 'Plan', 1, '2026-10-10T10:00:00Z'),
          board(6, 'Umowa', 3, '2026-10-11T10:00:00Z'),
          board(7, 'Luźna', null, '2026-10-12T10:00:00Z'),
        ],
      }),
    )
    const user = userEvent.setup()

    renderApp('/whiteboard')
    await user.click(await screen.findByRole('button', { name: 'Usuń folder: Praca' }))
    const dialog = await screen.findByRole('dialog', { name: 'Usunąć folder „Praca” i 2 elementy w nim?' })
    expect(within(dialog).getByText(/Podfoldery \(1\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Usuń folder' }))

    await vi.waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Folder: Praca' })).not.toBeInTheDocument(),
    )
    expect(screen.getAllByRole('button', { name: /^Otwórz (tablicę|notatkę)/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Otwórz tablicę: Luźna',
    ])
  })
})
