import { createFileRoute, useSearch } from "@tanstack/react-router";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { defaultProject, useProjectsStore } from "@/stores/projects";
import { useTimerStore } from "@/stores/timer";
import type { TimeEntryResponse } from "@/generated/api";

export const Route = createFileRoute("/timer")({
  component: TimerPage,
});

/**
 * "Zadanie" input backed by a datalist. The caret button mirrors the browser
 * dropdown: clicking it opens the suggestions (showPicker where available).
 */
function TaskTitleInput({
  listId,
  value,
  onChange,
}: {
  listId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function showSuggestions() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
      return;
    } catch {
      // showPicker can be unsupported or rejected — fall back to focusing.
      input.focus();
      input.click();
    }
  }

  return (
    <div className="relative">
      <input
        className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)] pr-8"
        ref={inputRef}
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-[12px] text-muted hover:text-ink"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={showSuggestions}
      >
        <span aria-hidden="true">▾</span>
      </button>
    </div>
  );
}

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
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie danych czasu…
      </div>
    );
  }

  if (pageError) {
    return (
      <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
        {pageError}
      </p>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Timer</h1>
        </div>
      </div>

      <section className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]" aria-label="Bieżący timer">
        <div className="absolute bottom-0 left-0 top-0 w-[5px] bg-signal"></div>
        {runningEntry ? (
          <>
            <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-signal">TIMER AKTYWNY</p>
            <p className="mt-1 font-display text-[20px] font-bold text-ink">{taskTitle(runningEntry)}</p>
            <p className="mt-2 font-utility text-[36px] font-bold tracking-tight text-ink">
              {formatElapsed(correctedNow - runningEntry.start.getTime())}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                type="button"
                onClick={() => void stopTimer()}
              >
                Zatrzymaj timer
              </button>
              <button
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
                type="button"
                onClick={() => void discardTimer()}
              >
                Odrzuć timer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-[14px] text-muted">Brak aktywnego timera. Wybierz projekt i zadanie, aby go uruchomić.</p>
            <form className="flex flex-col gap-4" onSubmit={startTimer}>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Projekt</span>
                <select
                  className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Zadanie</span>
                <TaskTitleInput
                  listId="start-task-titles"
                  value={startForm.title}
                  onChange={(title) =>
                    setStartForm((current) => ({ ...current, title }))
                  }
                />
                <datalist id="start-task-titles">
                  {startTasks.map((task) => (
                    <option key={task.id} value={task.title} />
                  ))}
                </datalist>
              </label>
              <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" type="submit">
                Rozpocznij timer
              </button>
            </form>
            {startError && (
              <p className="mt-4 text-[13px] text-[#a23a28]" role="alert">
                {startError}
              </p>
            )}
          </>
        )}
      </section>

      <section className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]" aria-labelledby="manual-entry-heading">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="manual-entry-heading" className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Dodaj wpis ręcznie</h2>
          </div>
        </div>
        <form className="flex flex-col gap-4" onSubmit={addManualEntry}>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Data</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Projekt</span>
            <select
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Zadanie</span>
            <TaskTitleInput
              listId="manual-task-titles"
              value={manualForm.title}
              onChange={(title) =>
                setManualForm((current) => ({ ...current, title }))
              }
            />
            <datalist id="manual-task-titles">
              {manualTasks.map((task) => (
                <option key={task.id} value={task.title} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Czas (minuty)</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
          <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" type="submit">
            Dodaj wpis
          </button>
        </form>
        {manualError && (
          <p className="mt-4 text-[13px] text-[#a23a28]" role="alert">
            {manualError}
          </p>
        )}
      </section>

      <section
        className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]"
        aria-labelledby="recent-entries-heading"
        aria-label="Ostatnie wpisy"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="recent-entries-heading" className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Ostatnie wpisy</h2>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#344d52]">
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
                className="rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
            <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
              {recentEntries.length}{" "}
              {recentEntries.length === 1 ? "WPIS" : "WPISÓW"}
            </span>
          </div>
        </div>
        {recentEntries.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">
            {entryRange === "today"
              ? "Brak wpisów na dziś."
              : "Brak wpisów w wybranym zakresie."}
          </p>
        ) : (
          <ul className="flex flex-col" aria-label="Ostatnie wpisy">
            {recentEntries.map((entry) => (
              <li className="grid min-h-[62px] grid-cols-[24px_18px_minmax(0,1fr)_auto] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]" key={entry.id}>
                <span className="font-utility text-[11px] text-muted">
                  {formatClock(entry.start)}–
                  {entry.end ? formatClock(entry.end) : "…"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium leading-snug text-ink">{taskTitle(entry)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
                    {formatDuration(entryMinutes(entry)).toUpperCase()}
                  </span>
                  <button
                    className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
                    type="button"
                    aria-label={`Edytuj wpis: ${taskTitle(entry)}`}
                    onClick={() => openEntryEditForm(entry)}
                  >
                    Edytuj
                  </button>
                  <button
                    className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#a23a28] transition-all hover:bg-[#f5e3dc] hover:text-[#872d1e]"
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
          <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]" aria-labelledby="summary-heading">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="summary-heading" className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Suma czasu</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-[#dce4df] bg-[#f8faf8] p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">Dziś łącznie</h3>
            <p className="mt-2 font-display text-[24px] font-bold text-ink">{formatDuration(todaysMinutes)}</p>
          </div>
          <div className="rounded border border-[#dce4df] bg-[#f8faf8] p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">Według zadania (dziś)</h3>
            {perTaskMinutes.size === 0 ? (
              <p className="mt-2 text-[13px] text-muted">Brak wpisów.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {[...perTaskMinutes.entries()].map(([taskId, minutes]) => (
                  <li key={taskId} className="flex items-center justify-between text-[13px]">
                    <span className="truncate text-ink">{taskTitles.get(taskId) ?? `Zadanie #${taskId}`}</span>
                    <span className="ml-2 font-utility text-[11px] text-muted">{formatDuration(minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded border border-[#dce4df] bg-[#f8faf8] p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">Ostatnie 7 dni</h3>
            <ul className="mt-2 flex flex-col gap-1">
              {dayKeys.map((key) => (
                <li key={key} className="flex items-center justify-between text-[13px]">
                  <span className="truncate text-ink">{key}</span>
                  <span className="ml-2 font-utility text-[11px] text-muted">{formatDuration(minutesByDay.get(key) ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {editingEntry && (
        <div
          className="fixed inset-0 z-5 flex items-center justify-center bg-[rgb(12_29_33/52%)] p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEntryEditor();
          }}
        >
          <section
            className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-edit-title"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">ZMIANA SZCZEGÓŁÓW</p>
                <h2 id="entry-edit-title" className="mt-1 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Edytuj wpis</h2>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[20px] leading-none text-muted transition-all hover:-translate-y-px cursor-pointer hover:text-ink"
                onClick={closeEntryEditor}
                aria-label="Zamknij"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={saveEntryEdit}>
              <label className="mb-4 block">
                <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Data</span>
                <input
                  className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
              <label className="mb-4 block">
                <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Zadanie</span>
                <TaskTitleInput
                  listId="edit-task-titles"
                  value={editForm.title}
                  onChange={(title) =>
                    setEditForm((current) => ({ ...current, title }))
                  }
                />
                <datalist id="edit-task-titles">
                  {tasks.map((task) => (
                    <option key={task.id} value={task.title} />
                  ))}
                </datalist>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Czas (minuty)</span>
                <input
                  className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
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
                <p className="mb-4 text-[13px] text-[#a23a28]" role="alert">
                  {editError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
                  type="button"
                  onClick={closeEntryEditor}
                >
                  Anuluj
                </button>
                <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" type="submit">
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