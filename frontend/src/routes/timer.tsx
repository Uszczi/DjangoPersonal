import { createFileRoute, useSearch } from "@tanstack/react-router";

import { useEffect, useState } from "react";

import { defaultProject, useProjectsStore } from "@personal/shared/stores/projects";
import { useTimerStore } from "@personal/shared/stores/timer";
import type { TimeEntryResponse } from "@personal/shared/generated/api";
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
  const openEntryEditor = useTimerStore((state) => state.openEntryEditor);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <LoadingStatus>Wczytywanie danych czasu…</LoadingStatus>;
  if (pageError) return <ErrorMessage>{pageError}</ErrorMessage>;

  const runningEntry = runningEntryRaw && runningEntryRaw.end == null ? runningEntryRaw : null;
  const stoppedEntries = entries.filter((entry) => entry.end != null);
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const titleOf = (entry: TimeEntryResponse) => entryTitle(entry, taskTitles);
  const defaultProjectId = String(project ?? defaultProject(projects)?.id ?? "");

  return (
    <>
      <PageHeader title="Timer" />
      <CurrentTimerPanel
        runningEntry={runningEntry}
        runningTitle={runningEntry ? titleOf(runningEntry) : ""}
        now={now + serverOffset}
        projects={projects}
        tasks={tasks}
        defaultProjectId={defaultProjectId}
      />
      <ManualEntryPanel projects={projects} tasks={tasks} defaultProjectId={defaultProjectId} />
      <RecentEntriesPanel
        entries={stoppedEntries}
        now={now}
        titleOf={titleOf}
        onEdit={openEntryEditor}
        error={actionError}
      />
      <TimeSummaryPanel entries={stoppedEntries} now={now} taskTitles={taskTitles} />
      {editingEntry && (
        <EntryEditorModal
          key={editingEntry.id}
          entry={editingEntry}
          tasks={tasks}
          taskTitles={taskTitles}
        />
      )}
    </>
  );
}
