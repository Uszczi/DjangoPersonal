import { createFileRoute, useSearch } from "@tanstack/react-router";

import { useEffect, useState } from "react";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { TIMER_LOAD_ERROR } from "@personal/shared/loadErrors";
import { defaultProject, useProjects } from "@personal/shared/queries/projects";
import { useAllTasks } from "@personal/shared/queries/tasks";
import { useTimeEntries, useTimer } from "@personal/shared/queries/timer";
import { CurrentTimerPanel } from "@/components/timer/CurrentTimerPanel";
import { EntryEditorModal } from "@/components/timer/EntryEditorModal";
import { entryTitle } from "@/components/timer/entries";
import { ManualEntryPanel } from "@/components/timer/ManualEntryPanel";
import { RecentEntriesPanel } from "@/components/timer/RecentEntriesPanel";
import { TimeSummaryPanel } from "@/components/timer/TimeSummaryPanel";
import { ErrorMessage, LoadingStatus, PageHeader } from "@/design-system";
import { validateProjectSearch } from "@/lib/projectSearch";

export const Route = createFileRoute("/timer")({
  validateSearch: validateProjectSearch,
  component: TimerPage,
});

function TimerPage() {
  const { project } = useSearch({ from: "/timer" });
  const { data: projects = [] } = useProjects();
  const timer = useTimer();
  const entriesQuery = useTimeEntries();
  const tasksQuery = useAllTasks();
  const [editingEntry, setEditingEntry] = useState<TimeEntryResponse | null>(
    null,
  );
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
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const titleOf = (entry: TimeEntryResponse) => entryTitle(entry, taskTitles);
  const defaultProjectId = String(
    project ?? defaultProject(projects)?.id ?? "",
  );

  return (
    <>
      <PageHeader title="Timer" />
      <CurrentTimerPanel
        runningEntry={runningEntry}
        runningTitle={runningEntry ? titleOf(runningEntry) : ""}
        now={now + serverOffset}
        serverOffset={serverOffset}
        projects={projects}
        tasks={tasks}
        defaultProjectId={defaultProjectId}
        onActionError={setActionError}
      />
      <ManualEntryPanel
        projects={projects}
        tasks={tasks}
        defaultProjectId={defaultProjectId}
      />
      <RecentEntriesPanel
        entries={stoppedEntries}
        now={now}
        titleOf={titleOf}
        onEdit={setEditingEntry}
        error={actionError}
      />
      <TimeSummaryPanel
        entries={stoppedEntries}
        now={now}
        taskTitles={taskTitles}
      />
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
