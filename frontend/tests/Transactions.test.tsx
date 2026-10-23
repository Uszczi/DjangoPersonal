/** User-visible Transaction flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

// API returns snake_case; the generated client maps it to camelCase.
const personalWalletApi = { id: 1, name: 'Personal', color: '#477c7c', transaction_count: 2 }

const categoriesApi = [{ id: 5, name: 'Jedzenie' }]

const coffeeTransactionApi = {
  id: 10,
  title: 'Kawa',
  amount: '8.00',
  date: '2026-10-16',
  description: 'Na rynku',
  category_id: 5,
  wallet_id: 1,
}

const lunchTransactionApi = {
  id: 11,
  title: 'Obiad',
  amount: '45.99',
  date: '2026-10-18',
  description: '',
  category_id: null,
  wallet_id: 1,
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Route mocks by URL so tests do not depend on fetch call order. */
function routeByUrl({
  transactions = [coffeeTransactionApi, lunchTransactionApi],
  created,
  patched,
  categories = categoriesApi,
}: {
  transactions?: unknown[]
  created?: unknown
  patched?: unknown
  categories?: unknown[]
} = {}) {
  return (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url)
    if (path.includes('/transactions/')) {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(created ?? {}, 201))
      }
      if (init?.method === 'PATCH') {
        return Promise.resolve(jsonResponse(patched ?? {}))
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse(null, 204))
      }
      return Promise.resolve(jsonResponse(transactions))
    }
    if (path.includes('/categories/')) {
      return Promise.resolve(jsonResponse(categories))
    }
    if (path.includes('/wallets/')) {
      return Promise.resolve(jsonResponse([personalWalletApi]))
    }
    if (path.includes('/projects/')) {
      return Promise.resolve(jsonResponse([{ id: 1, name: 'Inbox', description: '', is_inbox: true }]))
    }
    return Promise.resolve(jsonResponse({ detail: 'Not found' }, 404))
  }
}

describe('Transactions', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('transaction list is grouped by date with category and description', async () => {
    fetchMock.mockImplementation(routeByUrl())

    renderApp('/expenses/1')

    const firstDay = await screen.findByRole('list', { name: 'Transakcje z dnia 16 października 2026' })
    expect(within(firstDay).getByText('Kawa')).toBeInTheDocument()
    expect(within(firstDay).getByText('8.00')).toBeInTheDocument()
    expect(within(firstDay).getByText('Na rynku')).toBeInTheDocument()
    expect(within(firstDay).getByText('Jedzenie')).toBeInTheDocument()

    const secondDay = screen.getByRole('list', { name: 'Transakcje z dnia 18 października 2026' })
    expect(within(secondDay).getByText('Obiad')).toBeInTheDocument()
    expect(within(secondDay).getByText('45.99')).toBeInTheDocument()
  })

  test('user can add a transaction via a modal', async () => {
    const createdApi = {
      id: 12,
      title: 'Książka',
      amount: '34.90',
      date: '2026-10-18',
      description: 'Księgarnia',
      category_id: 5,
      wallet_id: 1,
    }
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [lunchTransactionApi],
        created: createdApi,
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses/1')
    await screen.findByRole('list', { name: 'Transakcje z dnia 18 października 2026' })

    await user.click(screen.getByRole('button', { name: 'Nowa transakcja' }))
    await user.type(await screen.findByLabelText('Tytuł'), 'Książka')
    await user.type(screen.getByLabelText('Kwota'), '34.90')
    await user.clear(screen.getByLabelText('Data'))
    await user.type(screen.getByLabelText('Data'), '2026-10-18')
    await user.type(screen.getByLabelText('Opis'), 'Księgarnia')
    await user.selectOptions(screen.getByLabelText('Kategoria'), '5')
    await user.click(screen.getByRole('button', { name: 'Dodaj transakcję' }))

    const secondDay = await screen.findByRole('list', { name: 'Transakcje z dnia 18 października 2026' })
    expect(within(secondDay).getByText('Książka')).toBeInTheDocument()
    expect(within(secondDay).getByText('34.90')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/transactions/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Książka',
          amount: '34.90',
          date: '2026-10-18',
          description: 'Księgarnia',
          category: 5,
          wallet: 1,
        }),
      }),
    )
  })

  test('amount must be positive with at most two decimal places', async () => {
    fetchMock.mockImplementation(routeByUrl())
    const user = userEvent.setup()

    renderApp('/expenses/1')
    await screen.findByRole('list', { name: 'Transakcje z dnia 18 października 2026' })

    await user.click(screen.getByRole('button', { name: 'Nowa transakcja' }))

    await user.type(await screen.findByLabelText('Tytuł'), 'Zła kwota')
    await user.type(screen.getByLabelText('Kwota'), '12.345')
    await user.click(screen.getByRole('button', { name: 'Dodaj transakcję' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kwota może mieć maksymalnie 2 miejsca dziesiętne.',
    )

    await user.clear(screen.getByLabelText('Kwota'))
    await user.type(screen.getByLabelText('Kwota'), '0')
    await user.click(screen.getByRole('button', { name: 'Dodaj transakcję' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kwota musi być większa od zera.')

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/transactions/'))).toHaveLength(1)
  })

  test('user can edit a transaction via a modal', async () => {
    const patchedApi = { ...coffeeTransactionApi, title: 'Kawa specjalna' }
    fetchMock.mockImplementation(
      routeByUrl({ transactions: [coffeeTransactionApi], patched: patchedApi }),
    )
    const user = userEvent.setup()

    renderApp('/expenses/1')
    const day = await screen.findByRole('list', { name: 'Transakcje z dnia 16 października 2026' })

    await user.click(screen.getByRole('button', { name: 'Edytuj transakcję: Kawa' }))

    const titleInput = await screen.findByLabelText('Tytuł')
    expect(titleInput).toHaveValue('Kawa')
    await user.clear(titleInput)
    await user.type(titleInput, 'Kawa specjalna')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await within(day).findByText('Kawa specjalna')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/transactions/10/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Kawa specjalna',
          amount: '8.00',
          date: '2026-10-16',
          description: 'Na rynku',
          category: 5,
          wallet: 1,
        }),
      }),
    )
  })

  test('the System category is not offered for a new transaction', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        categories: [...categoriesApi, { id: 9, name: 'System', is_system: true }],
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses/1')
    await screen.findByRole('list', { name: 'Transakcje z dnia 16 października 2026' })

    await user.click(screen.getByRole('button', { name: 'Nowa transakcja' }))
    const select = await screen.findByLabelText('Kategoria')

    expect(within(select).queryByRole('option', { name: 'System' })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Jedzenie' })).toBeInTheDocument()
  })

  test('editing a System-categorised transaction keeps its category', async () => {
    const correction = {
      id: 12,
      title: 'Korekta stanu',
      amount: '-20.00',
      date: '2026-10-18',
      description: '',
      category_id: 9,
      wallet_id: 1,
    }
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [correction],
        categories: [...categoriesApi, { id: 9, name: 'System', is_system: true }],
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses/1')
    await screen.findByRole('list', { name: 'Transakcje z dnia 18 października 2026' })

    await user.click(
      screen.getByRole('button', { name: 'Edytuj transakcję: Korekta stanu' }),
    )
    const select = await screen.findByLabelText('Kategoria')

    expect(within(select).getByRole('option', { name: 'System' })).toBeInTheDocument()
    expect(select).toHaveValue('9')
  })

  test('user can delete a transaction after confirming', async () => {
    fetchMock.mockImplementation(routeByUrl({ transactions: [coffeeTransactionApi] }))
    const user = userEvent.setup()

    renderApp('/expenses/1')
    await screen.findByRole('list', { name: 'Transakcje z dnia 16 października 2026' })

    await user.click(screen.getByRole('button', { name: 'Edytuj transakcję: Kawa' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń' }))

    expect(await screen.findByText(/zostanie trwale usunięta/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usuń transakcję' }))

    expect(await screen.findByText('Brak transakcji. Dodaj pierwszą transakcję.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/transactions/10/',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
