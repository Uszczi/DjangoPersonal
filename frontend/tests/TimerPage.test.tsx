/** User-visible Time tracking flow tests, with HTTP mocked at the network boundary. */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import App from '../src/App'

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

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })

    await user.click(screen.getByRole('button', { name: 'Czas' }))

    expect(await screen.findByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.getByText('Brak aktywnego timera. Uruchom go obok zadania na liście zadań.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dodaj wpis ręcznie' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wpisy z dziś' })).toBeInTheDocument()
    expect(screen.getByText('Brak wpisów na dziś.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suma czasu' })).toBeInTheDocument()
    expect(screen.getByText('Dziś łącznie')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/timer/', expect.objectContaining({ method: 'GET' }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/time-entries/', expect.objectContaining({ method: 'GET' }))
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/v1/tasks/?all=true', expect.objectContaining({ method: 'GET' }))
  })

  test('user can start a timer from a task row and stop it on the timer page', async () => {
    const runningEntry = { id: 5, task: task.id, start: '2026-10-15T12:00:00Z', end: null }
    const stoppedEntry = { ...runningEntry, end: '2026-10-15T12:30:00Z' }
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

    render(<App />)
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
      await screen.findByText('Brak aktywnego timera. Uruchom go obok zadania na liście zadań.'),
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
      render(<App />)
      await vi.waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument(),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Czas' }))

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

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })
    await user.click(screen.getByRole('button', { name: 'Czas' }))
    await screen.findByRole('heading', { name: 'Dodaj wpis ręcznie' })

    await user.selectOptions(screen.getByLabelText('Zadanie'), String(task.id))
    await user.type(screen.getByLabelText('Czas (minuty)'), '45')
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

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })
    await user.click(screen.getByRole('button', { name: 'Czas' }))
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

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })
    await user.click(screen.getByRole('button', { name: 'Czas' }))
    await screen.findByText('TIMER AKTYWNY')

    expect(
      screen.queryByRole('button', { name: 'Edytuj wpis: Prepare outline' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Odrzuć timer' }))

    expect(
      await screen.findByText(
        'Brak aktywnego timera. Uruchom go obok zadania na liście zadań.',
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

    render(<App />)
    await screen.findByRole('heading', { name: 'Inbox' })
    await user.click(screen.getByRole('button', { name: 'Czas' }))

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
