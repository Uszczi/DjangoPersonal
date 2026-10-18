/** User-visible Category flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

const inbox = { id: 1, name: 'Inbox', description: '', is_inbox: true }
const wallet = { id: 1, name: 'Personal', transaction_count: 0 }

// API returns snake_case; the generated client maps it to camelCase.
const catJedzenie = { id: 1, name: 'Jedzenie' }
const catTransport = { id: 2, name: 'Transport' }

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The panel mounts only after the wallets finish loading: wallets, projects, categories. */
function mockInitial(categories: unknown[]) {
  return {
    wallets: jsonResponse([wallet]),
    projects: jsonResponse([inbox]),
    categories: jsonResponse(categories),
  }
}

describe('Categories', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('category panel lists the categories', async () => {
    const initial = mockInitial([catJedzenie, catTransport])
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)

    renderApp('/expenses')

    const list = await screen.findByRole('list', { name: 'Lista kategorii' })
    expect(within(list).getByText('Jedzenie')).toBeInTheDocument()
    expect(within(list).getByText('Transport')).toBeInTheDocument()
  })

  test('seeded base categories appear in the panel', async () => {
    const seeded = [
      'Jedzenie', 'Mieszkanie', 'Transport', 'Zdrowie', 'Rozrywka',
      'Zakupy', 'Rachunki', 'Edukacja', 'Podróże', 'Inne',
    ].map((name, index) => ({ id: index + 1, name }))
    const initial = mockInitial(seeded)
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)

    renderApp('/expenses')

    const list = await screen.findByRole('list', { name: 'Lista kategorii' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(within(list).getByText('Jedzenie')).toBeInTheDocument()
    expect(within(list).getByText('Inne')).toBeInTheDocument()
  })

  test('user can create a category inline', async () => {
    const initial = mockInitial([catJedzenie])
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(jsonResponse({ id: 9, name: 'Rachunki' }, 201))
    const user = userEvent.setup()

    renderApp('/expenses')
    const list = await screen.findByRole('list', { name: 'Lista kategorii' })

    await user.type(screen.getByLabelText('Nowa kategoria'), '  Rachunki  ')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(await within(list).findByText('Rachunki')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/categories/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Rachunki' }),
      }),
    )
  })

  test('duplicate category name shows an error', async () => {
    const initial = mockInitial([catJedzenie])
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'A category with this name already exists.' }, 400),
      )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByRole('list', { name: 'Lista kategorii' })

    await user.type(screen.getByLabelText('Nowa kategoria'), 'jedzenie')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A category with this name already exists.',
    )
  })

  test('user can rename a category inline', async () => {
    const initial = mockInitial([catJedzenie])
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Żywność' }))
    const user = userEvent.setup()

    renderApp('/expenses')
    const list = await screen.findByRole('list', { name: 'Lista kategorii' })

    await user.click(
      await screen.findByRole('button', { name: 'Zmień nazwę kategorii: Jedzenie' }),
    )
    const input = screen.getByLabelText('Nazwa kategorii')
    await user.clear(input)
    await user.type(input, 'Żywność')
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(await within(list).findByText('Żywność')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/categories/1/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Żywność' }),
      }),
    )
  })

  test('user can delete a category after confirming', async () => {
    const initial = mockInitial([catJedzenie])
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(jsonResponse(null, 204))
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByRole('list', { name: 'Lista kategorii' })

    await user.click(screen.getByRole('button', { name: 'Usuń kategorię: Jedzenie' }))
    expect(await screen.findByText(/zostanie trwale usunięta/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usuń kategorię' }))

    expect(await screen.findByText('Brak kategorii.')).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        '/api/v1/categories/1/',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })
})
