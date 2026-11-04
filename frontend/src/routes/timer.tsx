import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useEffect, useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { TIMER_LOAD_ERROR } from "@personal/shared/loadErrors";
import { defaultProject, useProjects } from "@personal/shared/queries/projects";
import { useAllTasks } from "@personal/shared/queries/tasks";
import { shortTaskTitle } from "@personal/shared/taskTitle";
import {
  useStartTimer,
  useTimeEntries,
  useTimer,
} from "@personal/shared/queries/timer";
import { EntryEditorModal } from "@/components/timer/EntryEditorModal";
import { entryTitle } from "@/components/timer/entries";
import { ManualEntryModal } from "@/components/timer/ManualEntryModal";
import { TimeLog } from "@/components/timer/TimeLog";
import { TimerBar } from "@/components/timer/TimerBar";
import { TimeStatsView } from "@/components/timer/TimeStatsView";
import { WeekStrip } from "@/components/timer/WeekStrip";
import {
  Button,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { validateProjectSearch, type ProjectSearch } from "@/lib/projectSearch";

type TimerSearch = ProjectSearch & {
  /** `stats` shows Statystyki; absent is the Dziennik. */
  view?: "stats";
};

export const Route = createFileRoute("/timer")({
  validateSearch: (search: Record<string, unknown>): TimerSearch => ({
    ...validateProjectSearch(search),
    view: search.view === "stats" ? "stats" : undefined,
  }),
  component: TimerPage,
});

function TimerPage() {
  const { project, view } = useSearch({ from: "/timer" });
  const { data: projects = [] } = useProjects();
  const timer = useTimer();
  const entriesQuery = useTimeEntries();
  const tasksQuery = useAllTasks();
  const startTimer = useStartTimer();
  const [editingEntry, setEditingEntry] = useState<TimeEntryResponse | null>(
    null,
  );
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [actionError, setActionError] = useState("");

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (timer.isError || entriesQuery.isError || tasksQuery.isError)
    return <ErrorMessage>{TIMER_LOAD_ERROR}</ErrorMessage>;
  if (timer.isPending || entriesQuery.isPending || tasksQuery.isPending)
    return <LoadingStatus>Wczytywanie danych czasu…</LoadingStatus>;

  const { runningEntry: runningEntryRaw, serverOffset } = timer.data;
  const entries = entriesQuery.data;
  const tasks = tasksQuery.data;
  const runningEntry =
    runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null;
  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const taskTitles = new Map(
    tasks.map((task) => [task.id, shortTaskTitle(task.title)]),
  );
  const titleOf = (entry: TimeEntryResponse) => entryTitle(entry, taskTitles);
  const defaultProjectId = String(
    project ?? defaultProject(projects)?.id ?? "",
  );
  const isStats = view === "stats";

  /** Start again on what an entry was: its Task if it has one, else its title. */
  async function resume(entry: TimeEntryResponse) {
    setActionError("");
    try {
      await startTimer.mutateAsync(
        entry.taskId != null ? { task: entry.taskId } : { title: entry.title },
      );
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  const tab = (active: boolean) =>
    `-mb-px border-b-2 px-1 pb-2 text-[14px] font-semibold no-underline ${active ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink"}`;

  return (
    <>
      <PageHeader
        title="Czas"
        actions={
          !isStats && (
            <Button variant="secondary" onClick={() => setIsAddingEntry(true)}>
              <Plus size={16} aria-hidden="true" /> Wpis ręczny
            </Button>
          )
        }
      />
      <nav
        aria-label="Widok czasu"
        className="mb-5 flex gap-6 border-b border-line"
      >
        <Link
          to="/timer"
          search={{ project }}
          className={tab(!isStats)}
          aria-current={isStats ? undefined : "page"}
        >
          Dziennik
        </Link>
        <Link
          to="/timer"
          search={{ project, view: "stats" }}
          className={tab(isStats)}
          aria-current={isStats ? "page" : undefined}
        >
          Statystyki
        </Link>
      </nav>
      {isStats ? (
        <TimeStatsView
          entries={stoppedEntries}
          tasks={tasks}
          projects={projects}
          now={now}
        />
      ) : (
        <>
          <TimerBar
            runningEntry={runningEntry}
            runningTitle={runningEntry ? titleOf(runningEntry) : ""}
            now={now + serverOffset}
            serverOffset={serverOffset}
            projects={projects}
            tasks={tasks}
            defaultProjectId={defaultProjectId}
            onActionError={setActionError}
          />
          <WeekStrip entries={stoppedEntries} now={now} />
          <TimeLog
            entries={stoppedEntries}
            now={now}
            tasks={tasks}
            projects={projects}
            titleOf={titleOf}
            onEdit={setEditingEntry}
            onResume={(entry) => void resume(entry)}
            error={actionError}
          />
        </>
      )}
      {isAddingEntry && (
        <ManualEntryModal
          projects={projects}
          tasks={tasks}
          defaultProjectId={defaultProjectId}
          onClose={() => setIsAddingEntry(false)}
        />
      )}
      {editingEntry && (
        <EntryEditorModal
          key={editingEntry.id}
          entry={editingEntry}
          tasks={tasks}
          taskTitles={taskTitles}
          onClose={() => setEditingEntry(null)}
          onActionError={setActionError}
        />
      )}
    </>
  );
}
