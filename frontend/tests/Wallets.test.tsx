/** User-visible Wallet flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

const inbox = { id: 1, name: 'Inbox', description: '', is_inbox: true }

// API returns snake_case; the generated client maps it to camelCase.
const personalWalletApi = {
  id: 1,
  name: 'Personal',
  transaction_count: 0,
}

const businessWalletApi = {
  id: 2,
  name: 'Business',
  transaction_count: 3,
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

  test('user can see the wallet list with transaction counts', async () => {
    // CategoryPanel mounts only after the wallets finish loading, so the
    // fetch order is wallets, projects, then categories.
    fetchMock
      .mockResolvedValueOnce(jsonResponse([personalWalletApi, businessWalletApi]))
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([])) // categories (CategoryPanel)

    renderApp('/expenses')

    const list = await screen.findByRole('list', { name: 'Portfele' })
    expect(within(list).getByText('Personal')).toBeInTheDocument()
    expect(within(list).getByText('Business')).toBeInTheDocument()
    const businessRow = within(list).getByText('Business').closest('li')
    expect(businessRow?.textContent).toContain('3 transakcje')
  })

  test('user can create a wallet', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))       // wallets list
      .mockResolvedValueOnce(jsonResponse([inbox]))  // projects (root layout)
      .mockResolvedValueOnce(jsonResponse([]))       // categories (CategoryPanel)
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, name: 'Personal', transaction_count: 0 }, 201),
      )
    const user = userEvent.setup()

    renderApp('/expenses')
    await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')

    await user.click(screen.getAllByRole('button', { name: 'Nowy portfel' })[0])
    await user.type(await screen.findByLabelText('Nazwa portfela'), '  Personal  ')
    await user.click(screen.getByRole('button', { name: 'Utwórz portfel' }))

    const list = await screen.findByRole('list', { name: 'Portfele' })
    expect(within(list).getByText('Personal')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/wallets/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Personal' }),
      }),
    )
  })

  test('user can rename a wallet', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([personalWalletApi]))
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([])) // categories (CategoryPanel)
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, name: 'Personal renamed', transaction_count: 0 }),
      )
    const user = userEvent.setup()

    renderApp('/expenses')
    const list = await screen.findByRole('list', { name: 'Portfele' })
    expect(within(list).getByText('Personal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edytuj portfel: Personal' }))

    await user.clear(await screen.findByLabelText('Nazwa portfela'))
    await user.type(screen.getByLabelText('Nazwa portfela'), 'Personal renamed')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await within(list).findByText('Personal renamed')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/wallets/1/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Personal renamed' }),
      }),
    )
  })

  test('user can delete a wallet with confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([personalWalletApi]))
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([])) // categories (CategoryPanel)
      .mockResolvedValueOnce(jsonResponse([], 204))
    const user = userEvent.setup()

    renderApp('/expenses')
    const list = await screen.findByRole('list', { name: 'Portfele' })
    expect(within(list).getByText('Personal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Usuń portfel: Personal' }))

    expect(await screen.findByText(/zostanie trwale usunięty/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usuń portfel' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')).toBeInTheDocument()
  })

  test('header select switches the active wallet', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([personalWalletApi, businessWalletApi]))
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([])) // categories (CategoryPanel)
    const user = userEvent.setup()

    const { router } = renderApp('/expenses')
    await screen.findByRole('list', { name: 'Portfele' })

    await user.selectOptions(screen.getByLabelText('Wybierz portfel'), '2')

    await waitFor(() => expect(router.state.location.pathname).toBe('/expenses/2'))
  })

  test('wallet list shows error on load failure', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Server error' }, 500))
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([])) // categories (CategoryPanel)

    renderApp('/expenses')

    expect(await screen.findByText(/Nie udało się wczytać portfeli/)).toBeInTheDocument()
  })

  test('unknown wallet URL redirects to the wallet list', async () => {
    // Parent (ExpensesPage), child (WalletDetailPage) and root (App) all fetch.
    // A persistent mock keeps every response consistent regardless of call order.
    fetchMock.mockResolvedValue(jsonResponse([]))

    const { router } = renderApp('/expenses/9999')

    expect(await screen.findByText('Brak portfeli. Utwórz pierwszy portfel.')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/expenses'))
  })
})
