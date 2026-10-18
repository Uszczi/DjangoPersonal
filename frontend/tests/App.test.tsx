/** User-visible ProjectResponse flow tests, with HTTP mocked at the network boundary. */

import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { DeleteProjectModal } from '@/components/DeleteProjectModal'
import { ProjectEditorModal } from '@/components/ProjectEditorModal'
import type { ProjectResponse } from '@/generated/api'
import { ShowModal } from '@/stores/modal'
import { renderApp } from './renderApp'

const inbox = {
  id: 1,
  name: 'Inbox',
  description: '',
  is_inbox: true,
}

const planning = {
  id: 2,
  name: 'Planning',
  description: '',
  is_inbox: false,
}

const task = {
  id: 7,
  title: 'Prepare outline',
  description: '',
  project_id: 2,
  is_completed: false,
}

// The project editor and delete dialog have no trigger in the current UI, so
// tests open them the same way the app does, through the modal store.
const inboxProject: ProjectResponse = {
  id: 1,
  name: 'Inbox',
  description: '',
  isInbox: true,
}

const planningProject: ProjectResponse = {
  id: 2,
  name: 'Planning',
  description: '',
  isInbox: false,
}

const readingProject: ProjectResponse = {
  id: 2,
  name: 'Reading',
  description: 'Books to explore',
  isInbox: false,
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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

  test('user can see Inbox and create a ProjectResponse', async () => {
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

    renderApp('/tasks')

    expect(await screen.findByRole('link', { name: 'Inbox' })).toBeInTheDocument()
    await screen.findByText('Nie ma tu jeszcze zadań.')

    await user.click(screen.getAllByRole('button', { name: 'Nowy projekt' })[0])
    await user.type(screen.getByLabelText('Nazwa projektu'), '  Planning  ')
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Quarterly plans')
    await user.click(screen.getByRole('button', { name: 'Utwórz projekt' }))

    expect(await screen.findByRole('link', { name: 'Planning' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/projects/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Planning', description: 'Quarterly plans' }),
      }),
    )
  })

  test('user can edit a ProjectResponse description and name', async () => {
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

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Reading' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    act(() => {
      ShowModal(ProjectEditorModal, { project: readingProject })
    })

    await user.clear(await screen.findByLabelText('Nazwa projektu'))
    await user.type(screen.getByLabelText('Nazwa projektu'), 'Research')
    await user.clear(screen.getByLabelText('Opis (opcjonalnie)'))
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Sources and notes')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByRole('link', { name: 'Research' })).toBeInTheDocument()
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

    renderApp('/tasks')

    await screen.findByRole('link', { name: 'Inbox' })
    const projectNavigation = screen.getByRole('navigation', { name: 'Projekty' })

    expect(
      within(projectNavigation)
        .getAllByRole('link')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Inbox', 'Alpha', 'Zulu'])
  })

  test('Inbox name is read-only in the project editor', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([]))

    renderApp('/tasks')
    await screen.findByRole('link', { name: 'Inbox' })

    act(() => {
      ShowModal(ProjectEditorModal, { project: inboxProject })
    })

    const inboxName = await screen.findByDisplayValue('Inbox')
    expect(inboxName).toHaveAttribute('readonly')
    expect(inboxName).toHaveValue('Inbox')
  })

  test('user can browse tasks in the selected project with open tasks first', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 2, title: 'Completed note', description: '', project_id: 1, is_completed: true },
        { id: 1, title: 'Open note', description: '', project_id: 1, is_completed: false },
      ]))

    renderApp('/tasks')

    await screen.findByRole('heading', { name: 'Zadania' })
    await screen.findByText('Open note')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/projects/',
      '/api/v1/tasks/?project=1',
    ])
    const taskList = screen.getByRole('list', { name: 'Zadania' })

    expect(
      within(taskList)
        .getAllByText(/Open note|Completed note/)
        .map((item) => item.textContent),
    ).toEqual(['Open note', 'Completed note'])
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
            project_id: 2,
            is_completed: false,
          },
          201,
        ),
      )
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await user.click(screen.getAllByRole('button', { name: 'Nowe zadanie' })[0])
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

  test('user can complete and reopen a task', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Planning', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 7, title: 'Prepare outline', description: '', project_id: 2, is_completed: false },
        { id: 6, title: 'Completed note', description: '', project_id: 2, is_completed: true },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 7,
        title: 'Prepare outline',
        description: '',
        project_id: 2,
        is_completed: true,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 7,
        title: 'Prepare outline',
        description: '',
        project_id: 2,
        is_completed: false,
      }))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('Prepare outline')
    const taskList = screen.getByRole('list', { name: 'Zadania' })
    const listedTaskTitles = () =>
      within(taskList)
        .getAllByText(/Prepare outline|Completed note/)
        .map((task) => task.textContent)

    await user.click(screen.getByRole('button', { name: 'Oznacz jako ukończone: Prepare outline' }))
    const reopenButton = await screen.findByRole('button', { name: 'Otwórz zadanie: Prepare outline' })
    expect(listedTaskTitles()).toEqual(['Completed note', 'Prepare outline'])
    await user.click(reopenButton)

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/tasks/7/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_completed: true }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/tasks/7/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_completed: false }),
      }),
    )
    expect(listedTaskTitles()).toEqual(['Prepare outline', 'Completed note'])
  })

  test('user can edit a task and move it to another project', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Planning', description: '', is_inbox: false },
        { id: 3, name: 'Archive', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 8, title: 'Capture scope', description: '', project_id: 2, is_completed: false },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 8,
        title: 'Capture requirements',
        description: 'Confirm with the team',
        project_id: 3,
        is_completed: false,
      }))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 8,
          title: 'Capture requirements',
          description: 'Confirm with the team',
          project_id: 3,
          is_completed: false,
        },
      ]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('Capture scope')
    await user.click(screen.getByRole('button', { name: 'Edytuj zadanie: Capture scope' }))
    await user.clear(screen.getByLabelText('Tytuł zadania'))
    await user.type(screen.getByLabelText('Tytuł zadania'), 'Capture requirements')
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'Confirm with the team')
    await user.selectOptions(screen.getByLabelText('Projekt zadania'), '3')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByText('Nie ma tu jeszcze zadań.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Archive' }))
    expect(await screen.findByText('Capture requirements')).toBeInTheDocument()
    expect(screen.getByText('Confirm with the team')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/tasks/8/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Capture requirements',
          description: 'Confirm with the team',
          project: 3,
        }),
      }),
    )
  })

  test('user can edit task details and see the changes in the list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Planning', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 9, title: 'First title', description: 'Old note', project_id: 2, is_completed: false },
      ]))
      .mockResolvedValueOnce(jsonResponse({
        id: 9,
        title: 'Updated title',
        description: 'New note',
        project_id: 2,
        is_completed: false,
      }))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('First title')
    await user.click(screen.getByRole('button', { name: 'Edytuj zadanie: First title' }))
    await user.clear(screen.getByLabelText('Tytuł zadania'))
    await user.type(screen.getByLabelText('Tytuł zadania'), 'Updated title')
    await user.clear(screen.getByLabelText('Opis (opcjonalnie)'))
    await user.type(screen.getByLabelText('Opis (opcjonalnie)'), 'New note')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByText('Updated title')).toBeInTheDocument()
    expect(screen.getByText('New note')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/tasks/9/',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated title',
          description: 'New note',
          project: 2,
        }),
      }),
    )
  })

  test('late task updates do not replace the newly selected ProjectResponse task list', async () => {
    const pendingUpdate = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(jsonResponse([
        inbox,
        { id: 2, name: 'Planning', description: '', is_inbox: false },
        { id: 3, name: 'Archive', description: '', is_inbox: false },
      ]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 7, title: 'Planning task', description: '', project_id: 2, is_completed: false },
      ]))
      .mockReturnValueOnce(pendingUpdate.promise)
      .mockResolvedValueOnce(jsonResponse([
        { id: 9, title: 'Archive task', description: '', project_id: 3, is_completed: false },
      ]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('Planning task')
    await user.click(screen.getByRole('button', { name: 'Oznacz jako ukończone: Planning task' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))

    await user.click(screen.getByRole('link', { name: 'Archive' }))
    await screen.findByText('Archive task')

    await act(async () => {
      pendingUpdate.resolve(jsonResponse({
        id: 7,
        title: 'Planning task',
        description: '',
        project_id: 2,
        is_completed: true,
      }))
      await pendingUpdate.promise
    })

    expect(await screen.findByRole('link', { name: 'Archive' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Archive task')).toBeInTheDocument()
    expect(screen.queryByText('Wczytywanie zadań…')).not.toBeInTheDocument()
  })
})

describe('Deleting tasks and projects', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('user must confirm before a task is permanently deleted', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([{ ...task, project_id: 1 }]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie: Prepare outline' }))

    expect(
      screen.getByRole('heading', { name: 'Usunąć zadanie?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Zadanie .Prepare outline. zostanie trwale usunięte/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(screen.getByText('Prepare outline')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/tasks/7/',
      expect.objectContaining({ method: 'DELETE' }),
    )

    await user.click(screen.getByRole('button', { name: 'Usuń zadanie: Prepare outline' }))
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie' }))

    await waitFor(() =>
      expect(screen.queryByText('Prepare outline')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Nie ma tu jeszcze zadań.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/tasks/7/',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  test('a task with recorded time cannot be deleted and the dialog explains why', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([{ ...task, project_id: 1 }]))
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'A task with recorded time entries cannot be deleted.' }, 400),
      )
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie: Prepare outline' }))
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie' }))

    expect(
      await screen.findByText('A task with recorded time entries cannot be deleted.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Prepare outline')).toBeInTheDocument()
  })

  test('user must confirm before a project is deleted and learns its tasks are deleted', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox, planning]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByText('Prepare outline')

    act(() => {
      ShowModal(DeleteProjectModal, { project: planningProject })
    })

    expect(screen.getByRole('heading', { name: 'Usunąć projekt?' })).toBeInTheDocument()
    expect(
      screen.getByText(/Projekt .Planning. zostanie trwale usunięty wraz ze wszystkimi/),
    ).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Usuń projekt' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/projects/2/',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(screen.queryByRole('link', { name: 'Planning' })).not.toBeInTheDocument()
    expect(screen.queryByText('Prepare outline')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Inbox' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('cancelling project deletion keeps the project and its tasks', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox, planning]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Nie ma tu jeszcze zadań.')
    await user.click(screen.getByRole('link', { name: 'Planning' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    act(() => {
      ShowModal(DeleteProjectModal, { project: planningProject })
    })
    await user.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Planning' })).toBeInTheDocument()
    expect(screen.getByText('Prepare outline')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('Inbox offers no delete action', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([]))

    renderApp('/tasks')
    await screen.findByRole('link', { name: 'Inbox' })

    expect(screen.queryByRole('button', { name: 'Usuń projekt' })).not.toBeInTheDocument()
  })
})
