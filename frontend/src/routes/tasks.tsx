import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";

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
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TaskResponse } from "@personal/shared/generated/api";
import { TASKS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { defaultProject, useProjects } from "@personal/shared/queries/projects";
import {
  useProjectTasks,
  useToggleTaskStatus,
} from "@personal/shared/queries/tasks";
import { useStartTimer } from "@personal/shared/queries/timer";

export const Route = createFileRoute("/tasks")({
  validateSearch: validateProjectSearch,
  component: TasksPage,
});

function TasksPage() {
  const { project } = useSearch({ from: "/tasks" });
  const navigate = useNavigate();
  useProjectSearchParam(project);

  const { data: projects = [], isPending: isProjectsLoading } = useProjects();
  const toggleTaskStatus = useToggleTaskStatus();
  const startTaskTimer = useStartTimer();
  const [actionError, setActionError] = useState("");

  const isSidebarCollapsed = useLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;

  const {
    data: tasks = [],
    isPending: isTasksLoading,
    isError: isTasksError,
  } = useProjectTasks(selectedProject);
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

  async function toggleTask(task: TaskResponse) {
    setActionError("");
    try {
      await toggleTaskStatus.mutateAsync(task);
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  async function startTimer(task: TaskResponse) {
    setActionError("");
    try {
      await startTaskTimer.mutateAsync({ task: task.id });
    } catch (error) {
      setActionError(await apiErrorMessage(error));
      return;
    }
    navigate({
      to: "/timer",
      search: { project: selectedProjectId ?? undefined },
    });
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
          ) : isTasksError ? (
            <ErrorMessage>{TASKS_LOAD_ERROR}</ErrorMessage>
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
              onToggleTaskStatus={(task) => void toggleTask(task)}
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
