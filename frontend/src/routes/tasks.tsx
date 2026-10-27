import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { TaskEditorModal } from "@/components/modals/TaskEditorModal";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import {
  ProjectsDrawer,
  ProjectsDrawerToggle,
} from "@/components/tasks/ProjectsDrawer";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { validateProjectSearch } from "@/lib/projectSearch";
import { useProjectSearchParam } from "@/lib/useProjectSearchParam";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import {
  defaultProject,
  useProjectsStore,
} from "@personal/shared/stores/projects";
import { useTasksStore } from "@personal/shared/stores/tasks";
import type { TaskResponse } from "@personal/shared/generated/api";

export const Route = createFileRoute("/tasks")({
  validateSearch: validateProjectSearch,
  component: TasksPage,
});

function TasksPage() {
  const { project } = useSearch({ from: "/tasks" });
  const navigate = useNavigate();
  useProjectSearchParam(project);

  const projects = useProjectsStore((state) => state.projects);
  const isProjectsLoading = useProjectsStore((state) => state.isLoading);

  const taskList = useTasksStore((state) => state.taskList);
  const loadError = useTasksStore((state) => state.loadError);
  const actionError = useTasksStore((state) => state.actionError);
  const loadTasks = useTasksStore((state) => state.loadTasks);
  const toggleTaskStatus = useTasksStore((state) => state.toggleTaskStatus);
  const startTaskTimer = useTasksStore((state) => state.startTaskTimer);

  const isSidebarCollapsed = useLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId === null) return;
    void loadTasks(selectedProjectId);
  }, [loadTasks, selectedProjectId]);

  const tasks = taskList?.projectId === selectedProjectId ? taskList.tasks : [];
  const [isProjectsDrawerOpen, setProjectsDrawerOpen] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<
    ReadonlySet<string>
  >(new Set());

  function expandStatus(status: string) {
    setCollapsedStatuses((current) => {
      if (!current.has(status)) return current;
      const next = new Set(current);
      next.delete(status);
      return next;
    });
  }

  function toggleStatusSection(status: string) {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function openTaskForm() {
    const defaultStatus = selectedProject?.projectStatuses[0];
    if (defaultStatus) expandStatus(defaultStatus);
    ShowModal(TaskEditorModal, { projectId: selectedProject?.id });
  }

  async function startTimer(task: TaskResponse) {
    if (await startTaskTimer(task)) {
      navigate({
        to: "/timer",
        search: { project: selectedProjectId ?? undefined },
      });
    }
  }

  if (isProjectsLoading) {
    return <LoadingStatus>Wczytywanie projektów…</LoadingStatus>;
  }

  if (!selectedProject) {
    return (
      <EmptyState
        titleAs="h1"
        eyebrow="BRAK PROJEKTÓW"
        title="Utwórz pierwsze miejsce pracy"
      >
        <Button variant="primary" onClick={() => ShowModal(ProjectEditorModal)}>
          Nowy projekt
        </Button>
      </EmptyState>
    );
  }

  const tasksError =
    loadError?.projectId === selectedProjectId ? loadError.message : "";
  const isTasksLoading =
    taskList?.projectId !== selectedProjectId &&
    loadError?.projectId !== selectedProjectId;

  return (
    <>
      {isProjectsDrawerOpen && (
        <ProjectsDrawer
          selectedProjectId={selectedProjectId}
          onClose={() => setProjectsDrawerOpen(false)}
        />
      )}
      <div className="flex flex-1 gap-8">
        <ProjectsSidebar
          selectedProjectId={selectedProjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <section
          className="flex min-w-0 flex-1 flex-col"
          aria-labelledby="tasks-heading"
        >
          <PageHeader
            title={selectedProject.name}
            titleId="tasks-heading"
            leading={
              <ProjectsDrawerToggle
                isOpen={isProjectsDrawerOpen}
                onOpen={() => setProjectsDrawerOpen(true)}
              />
            }
            actions={
              <>
                <span className="mr-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
                  {tasks.length} {tasks.length === 1 ? "ZADANIE" : "ZADAŃ"}
                </span>
                <Button variant="primary" onClick={openTaskForm}>
                  <span aria-hidden="true">+</span>
                  Nowe zadanie
                </Button>
              </>
            }
          />

          {isTasksLoading ? (
            <LoadingStatus variant="inline">Wczytywanie zadań…</LoadingStatus>
          ) : tasksError ? (
            <ErrorMessage>{tasksError}</ErrorMessage>
          ) : tasks.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">
              Nie ma tu jeszcze zadań.
            </p>
          ) : (
            <TaskBoard
              project={selectedProject}
              tasks={tasks}
              collapsedStatuses={collapsedStatuses}
              onToggleCollapsed={toggleStatusSection}
              onToggleTaskStatus={(task) => void toggleTaskStatus(task)}
              onStartTimer={(task) => void startTimer(task)}
              onEditTask={(task) => ShowModal(TaskEditorModal, { task })}
            />
          )}
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={openTaskForm}>
              <span aria-hidden="true">+</span>
              Nowe zadanie
            </Button>
          </div>
          {actionError && <ErrorMessage>{actionError}</ErrorMessage>}
        </section>
      </div>
    </>
  );
}
