/** User-visible Wallet flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useWalletsStore } from '@/stores/wallets'

import { renderApp } from './renderApp'

const inbox = { id: 1, name: 'Inbox', description: '', is_inbox: true }

// API returns snake_case; the generated client maps it to camelCase.
const personalWalletApi = {
  id: 1,
  name: 'Personal',
  color: '#477c7c',
  transaction_count: 0,
  balance: '0.00',
}

const businessWalletApi = {
  id: 2,
  name: 'Business',
  color: '#d45b3e',
  transaction_count: 3,
  balance: '120.00',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Route mocks by URL so tests do not depend on fetch call order. */
function routeByUrl({
  wallets = [personalWalletApi],
  written,
  walletsStatus = 200,
  transactions = () => [],
}: {
  wallets?: unknown[]
  /** The body answered to a wallet POST/PATCH. */
  written?: unknown
  walletsStatus?: number
  /** The transaction list, asked for on every request (so it can change mid-test). */
  transactions?: () => unknown[]
} = {}) {
  return (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url)
    if (path.includes('/wallets/')) {
      if (init?.method === 'POST') return Promise.resolve(jsonResponse(written ?? {}, 201))
      if (init?.method === 'PATCH') return Promise.resolve(jsonResponse(written ?? {}))
      if (init?.method === 'DELETE') return Promise.resolve(jsonResponse(null, 204))
      return Promise.resolve(
        jsonResponse(walletsStatus === 200 ? wallets : { detail: 'Server error' }, walletsStatus),
      )
    }
    if (path.includes('/projects/')) return Promise.resolve(jsonResponse([inbox]))
    if (path.includes('/transactions/')) return Promise.resolve(jsonResponse(transactions()))
    if (path.includes('/categories/')) return Promise.resolve(jsonResponse([]))
    return Promise.resolve(jsonResponse({ detail: 'Not found' }, 404))
  }
}

/** The wallet switcher: one link per wallet, the shown one marked current. */
function switcher() {
  return screen.getByRole('navigation', { name: 'Wybierz portfel' })
}

describe('Wallets', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('the expenses page shows the first wallet when none is selected yet', async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    )

    renderApp('/expenses')

    expect(await screen.findByRole('region', { name: 'Portfel: Business' })).toBeInTheDocument()
    expect(within(switcher()).getByRole('link', { name: 'Business' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.queryByRole('list', { name: 'Portfele' })).not.toBeInTheDocument()
  })

  test('the expenses page shows the wallet selected in the store', async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    )
    const user = userEvent.setup()

    const { router } = renderApp('/expenses')
    await screen.findByRole('region', { name: 'Portfel: Business' })

    await user.click(within(switcher()).getByRole('link', { name: 'Personal' }))
    await screen.findByRole('region', { name: 'Portfel: Personal' })
    expect(useWalletsStore.getState().selectedWalletId).toBe(1)

    await router.navigate({ to: '/expenses' })
    expect(await screen.findByRole('region', { name: 'Portfel: Personal' })).toBeInTheDocument()
  })

  test('user can create a wallet and it becomes the shown wallet', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: { id: 1, name: 'Personal', color: '#477c7c', transaction_count: 0, balance: '0.00' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')

    await user.click(screen.getByRole('button', { name: 'Nowy portfel' }))
    await user.type(await screen.findByLabelText('Nazwa portfela'), '  Personal  ')
    await user.click(screen.getByRole('button', { name: 'Utwórz portfel' }))

    expect(await screen.findByRole('region', { name: 'Portfel: Personal' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Personal', color: '#477c7c' }),
      }),
    )
  })

  test('user can open a wallet with an initial balance', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: { id: 1, name: 'Personal', color: '#477c7c', transaction_count: 1, balance: '250.00' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')

    await user.click(screen.getByRole('button', { name: 'Nowy portfel' }))
    await user.type(await screen.findByLabelText('Nazwa portfela'), 'Personal')
    await user.type(screen.getByLabelText('Stan początkowy'), '250')
    await user.click(screen.getByRole('button', { name: 'Utwórz portfel' }))

    const shown = await screen.findByRole('region', { name: 'Portfel: Personal' })
    expect(within(shown).getByText('250.00')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Personal', color: '#477c7c', initial_balance: '250' }),
      }),
    )
  })

  test('user can set the current balance from the edit modal', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        written: { id: 1, name: 'Personal', color: '#477c7c', transaction_count: 1, balance: '75.00' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    const balanceInput = await screen.findByLabelText('Stan aktualny')
    expect(balanceInput).toHaveValue('0.00')

    await user.clear(balanceInput)
    await user.type(balanceInput, '75')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/wallets/1/',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Personal', current_balance: '75' }),
        }),
      ),
    )
  })

  test('a new balance shows up as a correction transaction straight away', async () => {
    const correctionApi = {
      id: 50,
      title: 'Korekta stanu',
      amount: '75.00',
      date: '2026-10-24',
      description: '',
      category_id: null,
      wallet_id: 1,
    }
    let ledger: unknown[] = []
    fetchMock.mockImplementation(
      routeByUrl({
        written: { ...personalWalletApi, transaction_count: 1, balance: '75.00' },
        transactions: () => ledger,
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    expect(await screen.findByText('Brak transakcji. Dodaj pierwszą transakcję.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    const balanceInput = await screen.findByLabelText('Stan aktualny')
    await user.clear(balanceInput)
    await user.type(balanceInput, '75')
    // The server writes the correction while handling the PATCH.
    ledger = [correctionApi]
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByText('Korekta stanu')).toBeInTheDocument()
  })

  test('a plain rename does not reload the transactions', async () => {
    fetchMock.mockImplementation(
      routeByUrl({ written: { ...personalWalletApi, name: 'Renamed' } }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    await screen.findByText('Brak transakcji. Dodaj pierwszą transakcję.')
    const transactionLoads = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/transactions/')).length
    const before = transactionLoads()

    await user.clear(await screen.findByLabelText('Nazwa portfela'))
    await user.type(screen.getByLabelText('Nazwa portfela'), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    await screen.findByRole('region', { name: 'Portfel: Renamed' })
    expect(transactionLoads()).toBe(before)
  })

  test('user can rename a wallet', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        written: { id: 1, name: 'Personal renamed', color: '#477c7c', transaction_count: 0, balance: '0.00' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))

    await user.clear(await screen.findByLabelText('Nazwa portfela'))
    await user.type(screen.getByLabelText('Nazwa portfela'), 'Personal renamed')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByRole('region', { name: 'Portfel: Personal renamed' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/1/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Personal renamed' }),
      }),
    )
  })

  test('user can pick a colour for a new wallet', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: { id: 1, name: 'Personal', color: '#3d6fb6', transaction_count: 0, balance: '0.00' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')

    await user.click(screen.getByRole('button', { name: 'Nowy portfel' }))
    await user.type(await screen.findByLabelText('Nazwa portfela'), 'Personal')
    expect(screen.getByRole('radio', { name: 'Morski' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Niebieski' }))
    await user.click(screen.getByRole('button', { name: 'Utwórz portfel' }))

    await screen.findByRole('region', { name: 'Portfel: Personal' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Personal', color: '#3d6fb6' }),
      }),
    )
  })

  test('user can change a wallet colour', async () => {
    fetchMock.mockImplementation(routeByUrl({ written: { ...personalWalletApi, color: '#4f8a3c' } }))
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    expect(await screen.findByRole('radio', { name: 'Morski' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Zielony' }))
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/wallets/1/',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Personal', color: '#4f8a3c' }),
        }),
      ),
    )
  })

  test('deleting the shown wallet falls back to the next one', async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Business' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń' }))

    expect(await screen.findByText(/zostanie trwale usunięty/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usuń portfel' }))

    expect(await screen.findByRole('region', { name: 'Portfel: Personal' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/2/',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  test('deleting the last wallet leaves the empty state', async () => {
    fetchMock.mockImplementation(routeByUrl())
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń' }))
    await user.click(await screen.findByRole('button', { name: 'Usuń portfel' }))

    expect(await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')).toBeInTheDocument()
  })

  test('user can give a new wallet an optional icon', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: { ...personalWalletApi, icon: 'piggy-bank' },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')

    await user.click(screen.getByRole('button', { name: 'Nowy portfel' }))
    await user.type(await screen.findByLabelText('Nazwa portfela'), 'Personal')
    await user.click(screen.getByRole('button', { name: 'Ikona portfela: Bez ikony' }))
    const popup = await screen.findByRole('group', { name: 'Ikona portfela' })
    expect(within(popup).getByRole('button', { name: 'Bez ikony' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(popup).getByRole('button', { name: 'Oszczędności' }))
    await user.click(screen.getByRole('button', { name: 'Utwórz portfel' }))

    await screen.findByRole('region', { name: 'Portfel: Personal' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/wallets/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Personal', color: '#477c7c', icon: 'piggy-bank' }),
      }),
    )
    // The icon stands in for the colour dot next to the wallet's name.
    await waitFor(() =>
      expect(switcher().querySelector('svg.lucide-piggy-bank')).not.toBeNull(),
    )
  })

  test('user can remove a wallet icon', async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [{ ...personalWalletApi, icon: 'piggy-bank' }],
        written: { ...personalWalletApi, icon: null },
      }),
    )
    const user = userEvent.setup()

    renderApp('/expenses')
    await user.click(await screen.findByRole('button', { name: 'Edytuj portfel: Personal' }))
    await user.click(await screen.findByRole('button', { name: 'Edytuj' }))
    await user.click(await screen.findByRole('button', { name: 'Ikona portfela: Oszczędności' }))
    await user.click(await screen.findByRole('button', { name: 'Bez ikony' }))
    expect(screen.getByRole('button', { name: 'Ikona portfela: Bez ikony' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/wallets/1/',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Personal', icon: null }),
        }),
      ),
    )
  })

  test('the wallet switcher lists every wallet and opens the chosen one', async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [personalWalletApi, businessWalletApi] }),
    )
    const user = userEvent.setup()

    const { router } = renderApp('/expenses')
    await screen.findByRole('region', { name: 'Portfel: Personal' })

    const links = within(switcher()).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Personal', 'Business'])
    await user.click(within(switcher()).getByRole('link', { name: 'Business' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/expenses/2'))
    expect(await screen.findByRole('region', { name: 'Portfel: Business' })).toBeInTheDocument()
  })

  test('the expenses page shows an error on load failure', async () => {
    fetchMock.mockImplementation(routeByUrl({ walletsStatus: 500 }))

    renderApp('/expenses')

    expect(await screen.findByText(/Nie udało się wczytać portfeli/)).toBeInTheDocument()
  })

  test('unknown wallet URL redirects to the expenses page', async () => {
    fetchMock.mockImplementation(routeByUrl({ wallets: [] }))

    const { router } = renderApp('/expenses/9999')

    expect(await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/expenses'))
  })
})
