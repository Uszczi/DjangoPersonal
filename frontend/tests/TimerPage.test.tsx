/** User-visible Time tracking flow tests, with HTTP mocked at the network boundary. */

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { renderApp } from './renderApp'

const inbox = {
  id: 1,
  name: 'Inbox',
  description: '',
  is_inbox: true,
}

const task = {
  id: 7,
  title: 'Prepare outline',
  description: '',
  project: 1,
  is_completed: false,
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysAgoKey(days: number) {
  const day = new Date()
  day.setDate(day.getDate() - days)
  return localDateKey(day)
}

function timerResponse(entry: unknown) {
  return jsonResponse({ entry, server_now: '2026-10-15T12:00:00Z' })
}

function entryPayload(id: number, dateKey: string, startTime: string, endTime: string) {
  return {
    id,
    task: task.id,
    start: `${dateKey}T${startTime}Z`,
    end: `${dateKey}T${endTime}Z`,
  }
}

describe('Time tracking', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('user can open the timer page and sees its sections', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByRole('link', { name: 'Inbox' })
    await screen.findByText('Nie ma tu jeszcze zadań.')

    await user.click(screen.getByRole('link', { name: 'Czas' }))

    expect(await screen.findByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByText('Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dodaj wpis ręcznie' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wpisy z dziś' })).toBeInTheDocument()
    expect(screen.getByText('Brak wpisów na dziś.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suma czasu' })).toBeInTheDocument()
    expect(screen.getByText('Dziś łącznie')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/timer/', expect.objectContaining({ method: 'GET' }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/time-entries/', expect.objectContaining({ method: 'GET' }))
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/v1/tasks/?all=true', expect.objectContaining({ method: 'GET' }))
  })

  test('the URL project preselects both forms and starts one of its tasks', async () => {
    const planning = { id: 2, name: 'Planning', description: '', is_inbox: false }
    const planningTask = { ...task, id: 8, title: 'Plan release', project: planning.id }
    const runningEntry = {
      id: 5,
      task: planningTask.id,
      start: `${daysAgoKey(0)}T12:00:00Z`,
      end: null,
    }
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url === '/api/v1/projects/') return Promise.resolve(jsonResponse([inbox, planning]))
      if (url === '/api/v1/timer/') return Promise.resolve(timerResponse(null))
      if (url === '/api/v1/time-entries/') return Promise.resolve(jsonResponse([]))
      if (url === '/api/v1/tasks/?all=true') {
        return Promise.resolve(jsonResponse([task, planningTask]))
      }
      if (url === '/api/v1/timer/start/') return Promise.resolve(timerResponse(runningEntry))
      return Promise.reject(new Error(`Unexpected request: ${url}`))
    })
    const user = userEvent.setup()

    renderApp('/timer?project=2')
    const timerSection = await screen.findByRole('region', { name: 'Bieżący timer' })
    const manualEntrySection = await screen.findByRole('region', { name: 'Dodaj wpis ręcznie' })

    expect(within(timerSection).getByLabelText('Projekt')).toHaveValue('2')
    expect(within(manualEntrySection).getByLabelText('Projekt')).toHaveValue('2')
    expect(within(timerSection).queryByRole('option', { name: 'Prepare outline' })).not.toBeInTheDocument()
    expect(within(manualEntrySection).queryByRole('option', { name: 'Prepare outline' })).not.toBeInTheDocument()

    await user.selectOptions(within(timerSection).getByLabelText('Zadanie'), String(planningTask.id))
    await user.click(within(timerSection).getByRole('button', { name: 'Rozpocznij timer' }))

    expect(await screen.findByText('TIMER AKTYWNY')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/timer/start/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task: planningTask.id }),
      }),
    )
  })

  test('user can start a timer from a task row and stop it on the timer page', async () => {
    const runningEntry = { id: 5, task: task.id, start: `${daysAgoKey(0)}T12:00:00Z`, end: null }
    const stoppedEntry = { ...runningEntry, end: `${daysAgoKey(0)}T12:30:00Z` }
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(runningEntry))
      .mockResolvedValueOnce(timerResponse(runningEntry))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(stoppedEntry))
      .mockResolvedValueOnce(jsonResponse([stoppedEntry]))
      .mockResolvedValueOnce(jsonResponse([task]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await user.click(await screen.findByRole('button', { name: 'Uruchom timer: Prepare outline' }))

    expect(await screen.findByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByText('TIMER AKTYWNY')).toBeInTheDocument()
    expect(screen.getAllByText('Prepare outline').length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/timer/start/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task: task.id }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Zatrzymaj timer' }))

    expect(
      await screen.findByText('Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.'),
    ).toBeInTheDocument()
    expect(screen.getByText('30 MIN')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/time-entries/',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  test('the running timer ticks every second', async () => {
    vi.useFakeTimers()
    try {
      const runningEntry = { id: 5, task: task.id, start: '2026-10-15T12:00:00Z', end: null }
      fetchMock
        .mockResolvedValueOnce(jsonResponse([inbox]))
        .mockResolvedValueOnce(jsonResponse([task]))
        .mockResolvedValueOnce(timerResponse(runningEntry))
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse([task]))
      renderApp('/tasks')
      await vi.waitFor(() =>
        expect(screen.getByText('Prepare outline')).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByRole('link', { name: 'Czas' }))

      await vi.waitFor(() => expect(screen.getByText('0:00:00')).toBeInTheDocument())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500)
      })
      expect(screen.queryByText('0:00:00')).not.toBeInTheDocument()
      expect(screen.getByText(/^0:00:0[1-9]$/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  test('user can add a manual entry and sees it in today’s list and summary', async () => {
    const created = entryPayload(6, daysAgoKey(0), '08:00:00', '08:45:00')
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(jsonResponse(created, 201))
      .mockResolvedValueOnce(jsonResponse([created]))
      .mockResolvedValueOnce(jsonResponse([task]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('link', { name: 'Czas' }))
    await screen.findByRole('heading', { name: 'Dodaj wpis ręcznie' })

    const manualEntrySection = screen.getByRole('region', { name: 'Dodaj wpis ręcznie' })
    await user.selectOptions(
      within(manualEntrySection).getByLabelText('Zadanie'),
      String(task.id),
    )
    await user.type(within(manualEntrySection).getByLabelText('Czas (minuty)'), '45')
    await user.click(screen.getByRole('button', { name: 'Dodaj wpis' }))

    expect(await screen.findByText('45 MIN')).toBeInTheDocument()
    const summaryHeading = screen.getByRole('heading', { name: 'Suma czasu' })
    const summarySection = summaryHeading.closest('section')
    if (!summarySection) throw new Error('summary section not found')
    expect(
      within(summarySection as HTMLElement).getByText('45 min', { selector: '.summary-total' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      '/api/v1/time-entries/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          task: task.id,
          date: daysAgoKey(0),
          duration_minutes: 45,
        }),
      }),
    )
  })

  test('user can edit and delete an entry', async () => {
    const original = entryPayload(6, daysAgoKey(0), '08:00:00', '08:45:00')
    const updated = entryPayload(6, daysAgoKey(0), '08:00:00', '09:00:00')
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([original]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(jsonResponse(updated))
      .mockResolvedValueOnce(jsonResponse([updated]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('link', { name: 'Czas' }))
    await screen.findByText('45 MIN')

    await user.click(screen.getByRole('button', { name: 'Edytuj wpis: Prepare outline' }))
    const dialog = screen.getByRole('dialog')
    await user.clear(within(dialog).getByLabelText('Czas (minuty)'))
    await user.type(within(dialog).getByLabelText('Czas (minuty)'), '60')
    await user.click(within(dialog).getByRole('button', { name: 'Zapisz zmiany' }))

    expect(await screen.findByText('1 H')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `/api/v1/time-entries/${original.id}/`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          task: task.id,
          date: daysAgoKey(0),
          duration_minutes: 60,
        }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Usuń wpis: Prepare outline' }))

    await screen.findByText('Brak wpisów na dziś.')
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      `/api/v1/time-entries/${original.id}/`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  test('user can discard the running timer so nothing is saved', async () => {
    const runningEntry = { id: 5, task: task.id, start: '2026-10-15T12:00:00Z', end: null }
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(runningEntry))
      .mockResolvedValueOnce(jsonResponse([runningEntry]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('link', { name: 'Czas' }))
    await screen.findByText('TIMER AKTYWNY')

    expect(
      screen.queryByRole('button', { name: 'Edytuj wpis: Prepare outline' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Odrzuć timer' }))

    expect(
      await screen.findByText(
        'Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Brak wpisów na dziś.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `/api/v1/time-entries/${runningEntry.id}/`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  test('summary shows today, per-task, and seven-day totals', async () => {
    const todayFirst = entryPayload(6, daysAgoKey(0), '08:00:00', '08:30:00')
    const todaySecond = entryPayload(7, daysAgoKey(0), '10:00:00', '10:45:00')
    const yesterday = entryPayload(8, daysAgoKey(1), '09:00:00', '10:30:00')
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([todayFirst, todaySecond, yesterday]))
      .mockResolvedValueOnce(jsonResponse([task]))
    const user = userEvent.setup()

    renderApp('/tasks')
    await screen.findByText('Prepare outline')
    await user.click(screen.getByRole('link', { name: 'Czas' }))

    const summary = await screen.findByRole('heading', { name: 'Suma czasu' })
    const summarySection = summary.closest('section')
    if (!summarySection) throw new Error('summary section not found')
    const withinSummary = within(summarySection as HTMLElement)

    expect(
      withinSummary.getByText('1 h 15 min', { selector: '.summary-total' }),
    ).toBeInTheDocument()
    expect(withinSummary.getAllByText('1 h 15 min')).toHaveLength(3)
    expect(withinSummary.getByText('Prepare outline')).toBeInTheDocument()
    expect(withinSummary.getByText(daysAgoKey(1))).toBeInTheDocument()
    expect(withinSummary.getByText('1 h 30 min')).toBeInTheDocument()
  })
})
