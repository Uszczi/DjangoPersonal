/** User-visible Project flow tests, with HTTP mocked at the network boundary. */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import App from '../src/App'

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
      .mockResolvedValueOnce(jsonResponse([]))
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
    await screen.findByText('Nie ma tu jeszcze zadań.')

    await user.click(screen.getByRole('button', { name: 'Nowy projekt' }))
    await user.type(screen.getByLabelText('Nazwa projektu'), '  Planning  ')
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Quarterly plans')
    await user.click(screen.getByRole('button', { name: 'Utwórz projekt' }))

    expect(await screen.findByRole('heading', { name: 'Planning' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
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
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('button', { name: 'Edytuj projekt' }))
    await user.clear(screen.getByLabelText('Nazwa projektu'))
    await user.type(screen.getByLabelText('Nazwa projektu'), 'Research')
    await user.clear(screen.getByLabelText('Opis (opcjonalnie)'))
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Sources and notes')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByRole('heading', { name: 'Research' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/projects/2/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Research', description: 'Sources and notes' }),
      }),
    )
  })

  test('user sees Inbox first and other Projects alphabetically', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        { id: 3, name: 'Zulu', description: '', is_inbox: false },
        inbox,
        { id: 2, name: 'Alpha', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))

    render(<App />)

    await screen.findByRole('heading', { name: 'Inbox' })
    const projectNavigation = screen.getByRole('navigation', { name: 'Projekty' })

    expect(
      within(projectNavigation)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Inbox', 'Alpha', 'Zulu'])
  })

  test('Inbox name is read-only in the project editor', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })
    await user.click(screen.getByRole('button', { name: 'Edytuj projekt' }))

    const inboxName = screen.getByDisplayValue('Inbox')
    expect(inboxName).toHaveAttribute('readonly')
    expect(inboxName).toHaveValue('Inbox')
  })

  test('user can browse tasks in the selected project with open tasks first', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 2, title: 'Completed note', description: '', project: 1, is_completed: true },
        { id: 1, title: 'Open note', description: '', project: 1, is_completed: false },
      ]))

    render(<App />)

    await screen.findByRole('heading', { name: 'Zadania' })
    await screen.findByText('Open note')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/projects/',
      '/api/v1/tasks/?project=1',
    ])
    const taskList = screen.getByRole('list', { name: 'Zadania' })

    expect(
      within(taskList).getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Open noteOTWARTE', '✓Completed noteUKOŃCZONE'])
  })

  test('user can create a task in the selected project', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Planning', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 4,
            title: 'Capture requirements',
            description: 'Talk to the team',
            project: 2,
            is_completed: false,
          },
          201,
        ),
      )
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByRole('heading', { name: 'Planning' })
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('button', { name: 'Nowe zadanie' }))
    await user.type(screen.getByLabelText('Tytuł zadania'), 'Capture requirements')
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Talk to the team')
    await user.click(screen.getByRole('button', { name: 'Utwórz zadanie' }))

    expect(await screen.findByText('Capture requirements')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/tasks/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: 'Capture requirements',
          description: 'Talk to the team',
          project: 2,
        }),
      }),
    )
  })
})
