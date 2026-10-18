import { createFileRoute, useSearch } from "@tanstack/react-router";

import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { defaultProject, useProjectsStore } from "@/stores/projects";
import { useTimerStore } from "@/stores/timer";
import type { TimeEntryResponse } from "@/generated/api";

export const Route = createFileRoute("/timer")({
  component: TimerPage,
});

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function entryMinutes(entry: TimeEntryResponse) {
  if (!entry.end) return 0;
  return Math.round((entry.end.getTime() - entry.start.getTime()) / 60000);
}

export function TimerPage() {
  const { project } = useSearch({ from: "__root__" });
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useTimerStore((state) => state.isLoading);
  const pageError = useTimerStore((state) => state.pageError);
  const runningEntryRaw = useTimerStore((state) => state.runningEntry);
  const serverOffset = useTimerStore((state) => state.serverOffset);
  const entries = useTimerStore((state) => state.entries);
  const tasks = useTimerStore((state) => state.tasks);
  const editingEntry = useTimerStore((state) => state.editingEntry);
  const actionError = useTimerStore((state) => state.actionError);
  const loadData = useTimerStore((state) => state.loadData);
  const startTimerAction = useTimerStore((state) => state.startTimer);
  const stopTimer = useTimerStore((state) => state.stopTimer);
  const discardTimer = useTimerStore((state) => state.discardTimer);
  const addManualEntryAction = useTimerStore((state) => state.addManualEntry);
  const updateEntryAction = useTimerStore((state) => state.updateEntry);
  const deleteEntryAction = useTimerStore((state) => state.deleteEntry);
  const openEntryEditor = useTimerStore((state) => state.openEntryEditor);
  const closeEntryEditor = useTimerStore((state) => state.closeEntryEditor);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [startForm, setStartForm] = useState({ projectId: "", title: "" });
  const [startError, setStartError] = useState("");
  const [manualForm, setManualForm] = useState({
    date: todayKey(),
    projectId: "",
    title: "",
    minutes: "",
  });
  const [manualError, setManualError] = useState("");
  const [editForm, setEditForm] = useState({
    date: "",
    title: "",
    minutes: "",
  });
  const [editError, setEditError] = useState("");
  const [entryRange, setEntryRange] = useState<"today" | "7" | "30" | "all">(
    "today",
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const today = dateKey(new Date(nowTick));
  const runningEntry =
    runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null;
  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const todaysEntries = stoppedEntries.filter(
    (entry) => dateKey(entry.start) === today,
  );
  const rangeStartKey = (days: number) => {
    const day = new Date(nowTick);
    day.setDate(day.getDate() - (days - 1));
    return dateKey(day);
  };
  const recentEntries = stoppedEntries.filter((entry) => {
    const key = dateKey(entry.start);
    if (entryRange === "today") return key === today;
    if (entryRange === "all") return true;
    const days = entryRange === "7" ? 7 : 30;
    return key >= rangeStartKey(days);
  });
  const todaysMinutes = todaysEntries.reduce(
    (sum, entry) => sum + entryMinutes(entry),
    0,
  );
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const taskTitle = (entry: TimeEntryResponse) =>
    entry.title ||
    (entry.taskId != null
      ? (taskTitles.get(entry.taskId as number) ?? `Zadanie #${entry.taskId}`)
      : "Bez tytułu");

  const perTaskMinutes = new Map<number, number>();
  for (const entry of todaysEntries) {
    if (entry.taskId == null) continue;
    const taskId = entry.taskId;
    perTaskMinutes.set(
      taskId,
      (perTaskMinutes.get(taskId) ?? 0) + entryMinutes(entry),
    );
  }

  const dayKeys = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(nowTick);
    day.setDate(day.getDate() - (6 - index));
    return dateKey(day);
  });
  const minutesByDay = new Map(dayKeys.map((key) => [key, 0]));
  for (const entry of stoppedEntries) {
    const key = dateKey(entry.start);
    if (minutesByDay.has(key)) {
      minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + entryMinutes(entry));
    }
  }

  const correctedNow = nowTick + serverOffset;
  const preselectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const startProjectId =
    startForm.projectId || String(preselectedProjectId ?? "");
  const manualProjectId =
    manualForm.projectId || String(preselectedProjectId ?? "");
  const startTasks = tasks.filter(
    (task) => task.projectId === Number(startProjectId),
  );
  const manualTasks = tasks.filter(
    (task) => task.projectId === Number(manualProjectId),
  );

  async function startTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = startForm.title.trim();

    if (!title) {
      setStartError("Podaj tytuł zadania.");
      return;
    }

    setStartError("");

    try {
      await startTimerAction(title);
      setStartForm((current) => ({ ...current, title: "" }));
    } catch (error) {
      setStartError(await apiErrorMessage(error));
    }
  }

  async function addManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = manualForm.title.trim();
    const minutes = Number(manualForm.minutes);

    if (!manualForm.date) {
      setManualError("Podaj datę wpisu.");
      return;
    }
    if (!title) {
      setManualError("Podaj tytuł zadania.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1) {
      setManualError("Podaj czas trwania w minutach (co najmniej 1).");
      return;
    }

    setManualError("");

    try {
      await addManualEntryAction({
        date: manualForm.date,
        title,
        minutes,
      });
      setManualForm((current) => ({
        date: todayKey(),
        projectId: current.projectId,
        title: "",
        minutes: "",
      }));
    } catch (error) {
      setManualError(await apiErrorMessage(error));
    }
  }

  function openEntryEditForm(entry: TimeEntryResponse) {
    openEntryEditor(entry);
    setEditForm({
      date: dateKey(entry.start),
      title:
        entry.title ||
        (entry.taskId != null ? (taskTitles.get(entry.taskId) ?? "") : ""),
      minutes: String(entryMinutes(entry)),
    });
    setEditError("");
  }

  async function saveEntryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEntry) return;
    const title = editForm.title.trim();
    const minutes = Number(editForm.minutes);

    if (!editForm.date) {
      setEditError("Podaj datę wpisu.");
      return;
    }
    if (!title) {
      setEditError("Podaj tytuł zadania.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1) {
      setEditError("Podaj czas trwania w minutach (co najmniej 1).");
      return;
    }

    setEditError("");

    try {
      await updateEntryAction(editingEntry, {
        date: editForm.date,
        title,
        minutes,
      });
    } catch (error) {
      setEditError(await apiErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie danych czasu…
      </div>
    );
  }

  if (pageError) {
    return (
      <p className="task-error" role="alert">
        {pageError}
      </p>
    );
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Timer</h1>
        </div>
      </div>

      <section className="" aria-label="Bieżący timer">
        <div className="card-topline"></div>
        {runningEntry ? (
          <>
            <p className="timer-status">TIMER AKTYWNY</p>
            <p className="timer-task-title">{taskTitle(runningEntry)}</p>
            <p className="timer-display">
              {formatElapsed(correctedNow - runningEntry.start.getTime())}
            </p>
            <div className="card-bottomline">
              <button
                className="primary-button"
                type="button"
                onClick={() => void stopTimer()}
              >
                Zatrzymaj timer
              </button>
              <button
                className="quiet-button"
                type="button"
                onClick={() => void discardTimer()}
              >
                Odrzuć timer
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.</p>
            <form className="timer-start-form" onSubmit={startTimer}>
              <label className="form-field">
                <span>Projekt</span>
                <select
                  value={startProjectId}
                  onChange={(event) =>
                    setStartForm({
                      projectId: event.target.value,
                      title: "",
                    })
                  }
                  required
                >
                  <option value="" disabled>
                    Wybierz projekt
                  </option>
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Zadanie</span>
                <div className="datalist-input">
                  <input
                    type="text"
                    list="start-task-titles"
                    value={startForm.title}
                    onChange={(event) =>
                      setStartForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <datalist id="start-task-titles">
                  {startTasks.map((task) => (
                    <option key={task.id} value={task.title} />
                  ))}
                </datalist>
              </label>
              <button className="primary-button" type="submit">
                Rozpocznij timer
              </button>
            </form>
            {startError && (
              <p className="form-error" role="alert">
                {startError}
              </p>
            )}
          </>
        )}
      </section>

      <section className="tasks-section" aria-labelledby="manual-entry-heading">
        <div className="task-section-heading">
          <div>
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
                setManualForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Projekt</span>
            <select
              value={manualProjectId}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  projectId: event.target.value,
                  title: "",
                }))
              }
              required
            >
              <option value="" disabled>
                Wybierz projekt
              </option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Zadanie</span>
            <div className="datalist-input">
              <input
                type="text"
                list="manual-task-titles"
                value={manualForm.title}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>
            <datalist id="manual-task-titles">
              {manualTasks.map((task) => (
                <option key={task.id} value={task.title} />
              ))}
            </datalist>
          </label>
          <label className="form-field">
            <span>Czas (minuty)</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={manualForm.minutes}
              onChange={(event) =>
                setManualForm((current) => ({
                  ...current,
                  minutes: event.target.value,
                }))
              }
              required
            />
          </label>
          <button className="primary-button" type="submit">
            Dodaj wpis
          </button>
        </form>
        {manualError && (
          <p className="form-error" role="alert">
            {manualError}
          </p>
        )}
      </section>

      <section
        className="tasks-section"
        aria-labelledby="recent-entries-heading"
        aria-label="Ostatnie wpisy"
      >
        <div className="task-section-heading">
          <div>
            <h2 id="recent-entries-heading">Ostatnie wpisy</h2>
          </div>
          <div className="task-section-controls">
            <label className="range-selector">
              <span>Zakres</span>
              <label
                htmlFor="entry-range"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                }}
              >
                Zakres czasu
              </label>
              <label
                htmlFor="entry-range"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                }}
              >
                Okres
              </label>
              <label
                htmlFor="entry-range"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0, 0, 0, 0)",
                }}
              >
                Zakres dat
              </label>
              <select
                id="entry-range"
                aria-label="Zakres"
                value={entryRange}
                onChange={(event) =>
                  setEntryRange(
                    event.target.value as "today" | "7" | "30" | "all",
                  )
                }
              >
                <option value="today">Dziś</option>
                <option value="7">Ostatnie 7 dni</option>
                <option value="30">Ostatnie 30 dni</option>
                <option value="all">Wszystkie</option>
              </select>
            </label>
            <span className="task-count">
              {recentEntries.length}{" "}
              {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
            </span>
          </div>
        </div>
        {recentEntries.length === 0 ? (
          <p className="task-empty-state">
            {entryRange === "today"
              ? "Brak wpisów na dziś."
              : "Brak wpisów w wybranym zakresie."}
          </p>
        ) : (
          <ul className="task-list" aria-label="Ostatnie wpisy">
            {recentEntries.map((entry) => (
              <li className="task-row entry-row" key={entry.id}>
                <span className="entry-time">
                  {formatClock(entry.start)}–
                  {entry.end ? formatClock(entry.end) : "…"}
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
                    onClick={() => openEntryEditForm(entry)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="task-edit-button"
                    type="button"
                    aria-label={`Usuń wpis: ${taskTitle(entry)}`}
                    onClick={() => void deleteEntryAction(entry)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {actionError && (
          <p className="task-error" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="tasks-section" aria-labelledby="summary-heading">
        <div className="task-section-heading">
          <div>
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
                    <span>
                      {taskTitles.get(taskId) ?? `Zadanie #${taskId}`}
                    </span>
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
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEntryEditor();
          }}
        >
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-edit-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ZMIANA SZCZEGÓŁÓW</p>
                <h2 id="entry-edit-title">Edytuj wpis</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={closeEntryEditor}
                aria-label="Zamknij"
              >
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
                    setEditForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Zadanie</span>
                <div className="datalist-input">
                  <input
                    type="text"
                    list="edit-task-titles"
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <datalist id="edit-task-titles">
                  {tasks.map((task) => (
                    <option key={task.id} value={task.title} />
                  ))}
                </datalist>
              </label>
              <label className="form-field">
                <span>Czas (minuty)</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={editForm.minutes}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      minutes: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              {editError && (
                <p className="form-error" role="alert">
                  {editError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={closeEntryEditor}
                >
                  Anuluj
                </button>
                <button className="primary-button" type="submit">
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
