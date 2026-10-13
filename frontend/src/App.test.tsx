import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import App from './App'

const inbox = {
  id: 1,
  name: 'Inbox',
  description: '',
  is_inbox: true,
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Projects', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('user can see Inbox and create a Project', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(
        jsonResponse(
          { id: 2, name: 'Planning', description: 'Quarterly plans', is_inbox: false },
          201,
        ),
      )
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nowy projekt' }))
    await user.type(screen.getByLabelText('Nazwa projektu'), '  Planning  ')
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Quarterly plans')
    await user.click(screen.getByRole('button', { name: 'Utwórz projekt' }))

    expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/projects/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Planning', description: 'Quarterly plans' }),
      }),
    )
  })

  test('user can edit a Project description and name', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Reading', description: 'Books to explore', is_inbox: false },
      ]))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 2,
          name: 'Research',
          description: 'Sources and notes',
          is_inbox: false,
        }),
      )
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Reading' }))
    await user.click(screen.getByRole('button', { name: 'Edytuj projekt' }))
    await user.clear(screen.getByLabelText('Nazwa projektu'))
    await user.type(screen.getByLabelText('Nazwa projektu'), 'Research')
    await user.clear(screen.getByLabelText('Opis (opcjonalnie)'))
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Sources and notes')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByRole('heading', { name: 'Research' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/projects/2/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Research', description: 'Sources and notes' }),
      }),
    )
  })
})
