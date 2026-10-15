import { useEffect, useState, type FormEvent } from 'react'

import { apiErrorMessage } from './apiErrorMessage'
import {
  Configuration,
  TasksApi,
  TimeEntriesApi,
  TimerApi,
  type Task,
  type TimeEntry,
  type TimerState,
} from './generated/api'

const timeEntriesApi = new TimeEntriesApi(new Configuration({ basePath: '' }))
const tasksApi = new TasksApi(new Configuration({ basePath: '' }))
const timerApi = new TimerApi(new Configuration({ basePath: '' }))

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayKey() {
  return dateKey(new Date())
}

function formatClock(date: Date) {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}

function entryMinutes(entry: TimeEntry) {
  if (!entry.end) return 0
  return Math.round((entry.end.getTime() - entry.start.getTime()) / 60000)
}

function TimerPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [runningEntryRaw, setRunningEntry] = useState<TimeEntry | null>(null)
  const [serverOffset, setServerOffset] = useState(0)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [manualForm, setManualForm] = useState({
    date: todayKey(),
    taskId: '',
    minutes: '',
  })
  const [manualError, setManualError] = useState('')
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editForm, setEditForm] = useState({ date: '', taskId: '', minutes: '' })
  const [editError, setEditError] = useState('')
  const [actionError, setActionError] = useState('')

  function applyTimerState(timer: TimerState) {
    setRunningEntry(timer.entry ?? null)
    setServerOffset(timer.serverNow.getTime() - Date.now())
  }

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      timerApi.timerRetrieve(),
      timeEntriesApi.timeEntriesList({}),
      tasksApi.tasksList({ all: true }),
    ])
      .then(([timer, loadedEntries, loadedTasks]) => {
        if (!isCurrent) return
        applyTimerState(timer)
        setEntries(loadedEntries)
        setTasks(loadedTasks)
      })
      .catch(() => {
        if (isCurrent) {
          setPageError('Nie udało się wczytać danych czasu. Odśwież stronę, aby spróbować ponownie.')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const today = dateKey(new Date(nowTick))
  const runningEntry =
    runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null
  const stoppedEntries = entries.filter((entry) => entry.end != null)
  const todaysEntries = stoppedEntries.filter((entry) => dateKey(entry.start) === today)
  const todaysMinutes = todaysEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]))
  const taskTitle = (entry: TimeEntry) => taskTitles.get(entry.task) ?? `Zadanie #${entry.task}`

  const perTaskMinutes = new Map<number, number>()
  for (const entry of todaysEntries) {
    perTaskMinutes.set(entry.task, (perTaskMinutes.get(entry.task) ?? 0) + entryMinutes(entry))
  }

  const dayKeys = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(nowTick)
    day.setDate(day.getDate() - (6 - index))
    return dateKey(day)
  })
  const minutesByDay = new Map(dayKeys.map((key) => [key, 0]))
  for (const entry of stoppedEntries) {
    const key = dateKey(entry.start)
    if (minutesByDay.has(key)) {
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + entryMinutes(entry))
    }
  }

  const correctedNow = nowTick + serverOffset

  async function refreshEntries() {
    setEntries(await timeEntriesApi.timeEntriesList({}))
  }

  async function stopTimer() {
    setActionError('')
    try {
      applyTimerState(await timerApi.timerStop())
      await refreshEntries()
    } catch (error) {
      setActionError(await apiErrorMessage(error))
    }
  }

  async function discardTimer() {
    if (!runningEntry) return
    setActionError('')
    try {
      await timeEntriesApi.timeEntriesDestroy({ id: runningEntry.id })
      await refreshEntries()
      setRunningEntry(null)
    } catch (error) {
      setActionError(await apiErrorMessage(error))
    }
  }

  async function addManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const taskId = Number(manualForm.taskId)
    const minutes = Number(manualForm.minutes)

    if (!manualForm.date) {
      setManualError('Podaj datę wpisu.')
      return
    }
    if (!Number.isInteger(taskId)) {
      setManualError('Wybierz zadanie.')
      return
    }
    if (!Number.isInteger(minutes) || minutes < 1) {
      setManualError('Podaj czas trwania w minutach (co najmniej 1).')
      return
    }

    setManualError('')
    try {
      await timeEntriesApi.timeEntriesCreate({
        timeEntryCreateRequest: {
          task: taskId,
          date: new Date(`${manualForm.date}T00:00:00`),
          durationMinutes: minutes,
        },
      })
      setManualForm({ date: todayKey(), taskId: '', minutes: '' })
      await refreshEntries()
    } catch (error) {
      setManualError(await apiErrorMessage(error))
    }
  }

  function openEntryEditor(entry: TimeEntry) {
    setEditingEntry(entry)
    setEditForm({
      date: dateKey(entry.start),
      taskId: String(entry.task),
      minutes: String(entryMinutes(entry)),
    })
    setEditError('')
  }

  async function saveEntryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEntry) return
    const taskId = Number(editForm.taskId)
    const minutes = Number(editForm.minutes)

    if (!editForm.date) {
      setEditError('Podaj datę wpisu.')
      return
    }
    if (!Number.isInteger(taskId)) {
      setEditError('Wybierz zadanie.')
      return
    }
    if (!Number.isInteger(minutes) || minutes < 1) {
      setEditError('Podaj czas trwania w minutach (co najmniej 1).')
      return
    }

    setEditError('')
    try {
      await timeEntriesApi.timeEntriesPartialUpdate({
        id: editingEntry.id,
        patchedTimeEntryRequest: {
          task: taskId,
          date: new Date(`${editForm.date}T00:00:00`),
          durationMinutes: minutes,
        },
      })
      setEditingEntry(null)
      await refreshEntries()
    } catch (error) {
      setEditError(await apiErrorMessage(error))
    }
  }

  async function deleteEntry(entry: TimeEntry) {
    setActionError('')
    try {
      await timeEntriesApi.timeEntriesDestroy({ id: entry.id })
      await refreshEntries()
    } catch (error) {
      setActionError(await apiErrorMessage(error))
    }
  }

  if (isLoading) {
    return <div className="loading-state" role="status">Wczytywanie danych czasu…</div>
  }

  if (pageError) {
    return <p className="task-error" role="alert">{pageError}</p>
  }

  return (
    <>
      <div className="breadcrumb">
        <span>PRZESTRZEŃ</span>
        <span className="breadcrumb-slash">/</span>
        <span>CZAS</span>
      </div>

      <div className="project-heading">
        <div>
          <p className="project-kicker">MONITORING CZASU</p>
          <h1>Timer</h1>
        </div>
      </div>

      <section className="project-card timer-card" aria-label="Bieżący timer">
        <div className="card-edge" aria-hidden="true" />
        <div className="card-topline">
          <span>{runningEntry ? 'TIMER AKTYWNY' : 'BRAK AKTYWNEGO TIMERA'}</span>
          <span className="card-mark" aria-hidden="true">✳</span>
        </div>
        {runningEntry ? (
          <>
            <p className="timer-task-title">{taskTitle(runningEntry)}</p>
            <p className="timer-display">
              {formatElapsed(correctedNow - runningEntry.start.getTime())}
            </p>
            <div className="card-bottomline">
              <button className="primary-button" type="button" onClick={() => void stopTimer()}>
                Zatrzymaj timer
              </button>
              <button className="quiet-button" type="button" onClick={() => void discardTimer()}>
                Odrzuć timer
              </button>
            </div>
          </>
        ) : (
          <p className="project-description">
            Brak aktywnego timera. Uruchom go obok zadania na liście zadań.
          </p>
        )}
      </section>

      <section className="tasks-section" aria-labelledby="manual-entry-heading">
        <div className="task-section-heading">
          <div>
            <p className="eyebrow">KOREKTA I DOPISKI</p>
            <h2 id="manual-entry-heading">Dodaj wpis ręcznie</h2>
          </div>
        </div>
        <form className="manual-entry-form" onSubmit={addManualEntry}>
          <label className="form-field">
            <span>Data</span>
            <input
              type="date"
              value={manualForm.date}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, date: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Zadanie</span>
            <select
              value={manualForm.taskId}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, taskId: event.target.value }))
              }
              required
            >
              <option value="" disabled>Wybierz zadanie</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Czas (minuty)</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={manualForm.minutes}
              onChange={(event) =>
                setManualForm((current) => ({ ...current, minutes: event.target.value }))
              }
              required
            />
          </label>
          <button className="primary-button" type="submit">Dodaj wpis</button>
        </form>
        {manualError && <p className="form-error" role="alert">{manualError}</p>}
      </section>

      <section className="tasks-section" aria-labelledby="today-entries-heading">
        <div className="task-section-heading">
          <div>
            <p className="eyebrow">GDZIE ZSZEDŁ DZIEŃ</p>
            <h2 id="today-entries-heading">Wpisy z dziś</h2>
          </div>
          <span className="task-count">
            {todaysEntries.length} {todaysEntries.length === 1 ? 'WPIS' : 'WPISÓW'}
          </span>
        </div>
        {todaysEntries.length === 0 ? (
          <p className="task-empty-state">Brak wpisów na dziś.</p>
        ) : (
          <ul className="task-list" aria-label="Wpisy z dziś">
            {todaysEntries.map((entry) => (
              <li className="task-row" key={entry.id}>
                <span className="entry-time">
                  {formatClock(entry.start)}
                  –
                  {entry.end ? formatClock(entry.end) : '…'}
                </span>
                <div className="task-copy">
                  <p>{taskTitle(entry)}</p>
                </div>
                <div className="task-row-actions">
                  <span className="task-status-label">
                    {formatDuration(entryMinutes(entry)).toUpperCase()}
                  </span>
                  <button
                    className="task-edit-button"
                    type="button"
                    aria-label={`Edytuj wpis: ${taskTitle(entry)}`}
                    onClick={() => openEntryEditor(entry)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="task-edit-button"
                    type="button"
                    aria-label={`Usuń wpis: ${taskTitle(entry)}`}
                    onClick={() => void deleteEntry(entry)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {actionError && <p className="task-error" role="alert">{actionError}</p>}
      </section>

      <section className="tasks-section" aria-labelledby="summary-heading">
        <div className="task-section-heading">
          <div>
            <p className="eyebrow">PODSUMOWANIE</p>
            <h2 id="summary-heading">Suma czasu</h2>
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-block">
            <h3>Dziś łącznie</h3>
            <p className="summary-total">{formatDuration(todaysMinutes)}</p>
          </div>
          <div className="summary-block">
            <h3>Według zadania (dziś)</h3>
            {perTaskMinutes.size === 0 ? (
              <p className="summary-empty">Brak wpisów.</p>
            ) : (
              <ul className="summary-list">
                {[...perTaskMinutes.entries()].map(([taskId, minutes]) => (
                  <li key={taskId}>
                    <span>{taskTitles.get(taskId) ?? `Zadanie #${taskId}`}</span>
                    <span>{formatDuration(minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="summary-block">
            <h3>Ostatnie 7 dni</h3>
            <ul className="summary-list">
              {dayKeys.map((key) => (
                <li key={key}>
                  <span>{key}</span>
                  <span>{formatDuration(minutesByDay.get(key) ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {editingEntry && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditingEntry(null)
        }}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-edit-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ZMIANA SZCZEGÓŁÓW</p>
                <h2 id="entry-edit-title">Edytuj wpis</h2>
              </div>
              <button className="icon-button close-button" onClick={() => setEditingEntry(null)} aria-label="Zamknij">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={saveEntryEdit}>
              <label className="form-field">
                <span>Data</span>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, date: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Zadanie</span>
                <select
                  value={editForm.taskId}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, taskId: event.target.value }))
                  }
                  required
                >
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Czas (minuty)</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={editForm.minutes}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, minutes: event.target.value }))
                  }
                  required
                />
              </label>
              {editError && <p className="form-error" role="alert">{editError}</p>}
              <div className="dialog-actions">
                <button className="quiet-button" type="button" onClick={() => setEditingEntry(null)}>
                  Anuluj
                </button>
                <button className="primary-button" type="submit">Zapisz zmiany</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default TimerPage
