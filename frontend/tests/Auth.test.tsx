import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'
import { useAuthStore } from '@personal/shared/stores/auth'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Auth', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('anonymous user visiting /tasks lands on login page', async () => {
    renderApp('/tasks', { authenticated: false })

    expect(await screen.findByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument()
  })

  test('login with valid credentials posts and navigates home', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access: 'access-1', refresh: 'refresh-1' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, username: 'alice' }),
      )

    const user = userEvent.setup()
    renderApp('/login', { authenticated: false })

    await screen.findByRole('heading', { name: 'Zaloguj się' })
    await user.type(screen.getByLabelText('Nazwa użytkownika'), 'alice')
    await user.type(screen.getByLabelText('Hasło'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/login/',
      expect.objectContaining({ method: 'POST' }),
    )

    expect(await within(await screen.findByRole('main')).findByRole('link', { name: /Wydatki/ })).toBeInTheDocument()
  })

  test('login with invalid credentials shows detail message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Invalid username or password.' }, 401),
    )

    const user = userEvent.setup()
    renderApp('/login', { authenticated: false })

    await screen.findByRole('heading', { name: 'Zaloguj się' })
    await user.type(screen.getByLabelText('Nazwa użytkownika'), 'alice')
    await user.type(screen.getByLabelText('Hasło'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Zaloguj się' }))

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument()
  })

  test('registration posts and navigates home', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ access: 'access-2', refresh: 'refresh-2' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 2, username: 'bob' }),
      )

    const user = userEvent.setup()
    renderApp('/register', { authenticated: false })

    await screen.findByRole('heading', { name: 'Załóż konto' })
    await user.type(screen.getByLabelText('Nazwa użytkownika'), 'bob')
    await user.type(screen.getByLabelText('Hasło'), 'secret')
    await user.type(screen.getByLabelText('Powtórz hasło'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Załóż konto' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/register/',
      expect.objectContaining({ method: 'POST' }),
    )

    expect(await within(await screen.findByRole('main')).findByRole('link', { name: /Wydatki/ })).toBeInTheDocument()
  })

  test('logout clears store and shows login', async () => {
    const user = userEvent.setup()
    renderApp('/', { authenticated: true })

    await screen.findByText('testuser')
    await user.click(screen.getByRole('button', { name: 'Wyloguj' }))

    expect(await screen.findByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument()
    expect(window.localStorage.getItem('auth')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})