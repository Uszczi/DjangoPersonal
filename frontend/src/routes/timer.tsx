import { createFileRoute, useSearch } from "@tanstack/react-router";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { validateProjectSearch } from "@/projectSearch";
import {
  Button,
  ErrorAlert,
  ErrorMessage,
  Field,
  ListRow,
  ListRowButton,
  ListRowTitle,
  LoadingStatus,
  Modal,
  ModalFooter,
  PageHeader,
  Select,
  TextInput,
} from "@/design-system";
import { defaultProject, useProjectsStore } from "@personal/shared/stores/projects";
import { useTimerStore } from "@personal/shared/stores/timer";
import type { TimeEntryResponse } from "@personal/shared/generated/api";

export const Route = createFileRoute("/timer")({
  validateSearch: validateProjectSearch,
  component: TimerPage,
});

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
      <TextInput
        className="pr-8"
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

function TimerPage() {
  const { project } = useSearch({ from: "/timer" });
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
  const [isEditingEntry, setIsEditingEntry] = useState(false);
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
    setIsEditingEntry(false);
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
      <LoadingStatus>
        Wczytywanie danych czasu…
      </LoadingStatus>
    );
  }

  if (pageError) {
    return (
      <ErrorMessage>
        {pageError}
      </ErrorMessage>
    );
  }

  return (
    <>
      <PageHeader title="Timer" />

      <section
        className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]"
        aria-label="Bieżący timer"
      >
        {runningEntry ? (
          <>
            <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-signal">
              TIMER AKTYWNY
            </p>
            <p className="mt-1 font-display text-[20px] font-bold text-ink">
              {taskTitle(runningEntry)}
            </p>
            <p className="mt-2 font-utility text-[36px] font-bold tracking-tight text-ink">
              {formatElapsed(correctedNow - runningEntry.start.getTime())}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Button variant="primary" onClick={() => void stopTimer()}>
                Zatrzymaj timer
              </Button>
              <Button variant="secondary" onClick={() => void discardTimer()}>
                Odrzuć timer
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-[14px] text-muted">
              Brak aktywnego timera. Wybierz projekt i zadanie, aby go
              uruchomić.
            </p>
            <form className="flex flex-col gap-4" onSubmit={startTimer}>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                  Projekt
                </span>
                <Select
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
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
                  Zadanie
                </span>
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
              <Button variant="primary" type="submit">
                Rozpocznij timer
              </Button>
            </form>
            {startError && (
              <p className="mt-4 text-[13px] text-danger" role="alert">
                {startError}
              </p>
            )}
          </>
        )}
      </section>

      <section
        className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]"
        aria-labelledby="manual-entry-heading"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2
              id="manual-entry-heading"
              className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink"
            >
              Dodaj wpis ręcznie
            </h2>
          </div>
        </div>
        <form className="flex flex-col gap-4" onSubmit={addManualEntry}>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
              Data
            </span>
            <TextInput
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
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
              Projekt
            </span>
            <Select
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
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
              Zadanie
            </span>
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
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">
              Czas (minuty)
            </span>
            <TextInput
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
          <Button variant="primary" type="submit">
            Dodaj wpis
          </Button>
        </form>
        {manualError && (
          <p className="mt-4 text-[13px] text-danger" role="alert">
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
            <h2
              id="recent-entries-heading"
              className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink"
            >
              Ostatnie wpisy
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
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
                className="rounded border border-control-border bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-accent focus:ring-[3px] focus:ring-accent/15"
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
              <ListRow key={entry.id}>
                <ListRowButton
                  aria-label={`Edytuj wpis: ${taskTitle(entry)}`}
                  onClick={() => openEntryEditForm(entry)}
                >
                  <span className="shrink-0 font-utility text-[11px] text-muted">
                    {formatClock(entry.start)}–
                    {entry.end ? formatClock(entry.end) : "…"}
                  </span>
                  <ListRowTitle>{taskTitle(entry)}</ListRowTitle>
                </ListRowButton>
                <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
                  {formatDuration(entryMinutes(entry)).toUpperCase()}
                </span>
              </ListRow>
            ))}
          </ul>
        )}
        {actionError && (
          <ErrorMessage>
            {actionError}
          </ErrorMessage>
        )}
      </section>

      <section
        className="mb-6 rounded-[7px] border border-[#dce4df] bg-paper p-[27px_32px_22px_37px] shadow-[0_14px_35px_rgb(29_55_57/5%)]"
        aria-labelledby="summary-heading"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2
              id="summary-heading"
              className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink"
            >
              Suma czasu
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded border border-[#dce4df] bg-surface p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
              Dziś łącznie
            </h3>
            <p className="mt-2 font-display text-[24px] font-bold text-ink">
              {formatDuration(todaysMinutes)}
            </p>
          </div>
          <div className="rounded border border-[#dce4df] bg-surface p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
              Według zadania (dziś)
            </h3>
            {perTaskMinutes.size === 0 ? (
              <p className="mt-2 text-[13px] text-muted">Brak wpisów.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {[...perTaskMinutes.entries()].map(([taskId, minutes]) => (
                  <li
                    key={taskId}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <span className="truncate text-ink">
                      {taskTitles.get(taskId) ?? `Zadanie #${taskId}`}
                    </span>
                    <span className="ml-2 font-utility text-[11px] text-muted">
                      {formatDuration(minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded border border-[#dce4df] bg-surface p-4">
            <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
              Ostatnie 7 dni
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {dayKeys.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="truncate text-ink">{key}</span>
                  <span className="ml-2 font-utility text-[11px] text-muted">
                    {formatDuration(minutesByDay.get(key) ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {editingEntry && (
        <Modal
          kicker="ZMIANA SZCZEGÓŁÓW"
          title="Edytuj wpis"
          titleId="entry-edit-title"
          onClose={closeEntryEditor}
          onEdit={isEditingEntry ? undefined : () => setIsEditingEntry(true)}
          size="lg"
        >
          <form onSubmit={saveEntryEdit}>
            <fieldset disabled={!isEditingEntry} className="contents">
              <Field label="Data">
                <TextInput
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
              </Field>
              <Field label="Zadanie">
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
              </Field>
              <Field label="Czas (minuty)">
                <TextInput
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
              </Field>
            </fieldset>
            {editError && <ErrorAlert>{editError}</ErrorAlert>}
            {isEditingEntry && (
              <ModalFooter>
                <Button
                  variant="ghostDanger"
                  className="mr-auto"
                  onClick={() => {
                    const entry = editingEntry;
                    closeEntryEditor();
                    void deleteEntryAction(entry);
                  }}
                >
                  Usuń
                </Button>
                <Button variant="secondary" onClick={closeEntryEditor}>
                  Anuluj
                </Button>
                <Button variant="primary" type="submit">
                  Zapisz zmiany
                </Button>
              </ModalFooter>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
