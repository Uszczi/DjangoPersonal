import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  ErrorMessage,
  IconButton,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { TaskEditorModal } from "@/components/modals/TaskEditorModal";
import { TaskListSettingsModal } from "@/components/modals/TaskListSettingsModal";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import {
  ProjectsDrawer,
  ProjectsDrawerToggle,
} from "@/components/tasks/ProjectsDrawer";
import { TagFilter } from "@/components/tags/TagFilter";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { validateProjectSearch, type ProjectSearch } from "@/lib/projectSearch";
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
import { useTags } from "@personal/shared/queries/tags";
import { useStartTimer } from "@personal/shared/queries/timer";
import {
  initialNewTaskStatus,
  useNewTaskStatusStore,
} from "@personal/shared/stores/newTaskStatus";
import { useCollapsedStatuses } from "@personal/shared/useCollapsedStatuses";

/** `?project=` plus `?tag=`, the Tag the list is narrowed to. */
function validateTasksSearch(
  search: Record<string, unknown>,
): ProjectSearch & { tag?: string } {
  return {
    ...validateProjectSearch(search),
    tag: typeof search.tag === "string" ? search.tag : undefined,
  };
}

export const Route = createFileRoute("/tasks")({
  validateSearch: validateTasksSearch,
  component: TasksPage,
});

function TasksPage() {
  const { project, tag } = useSearch({ from: "/tasks" });
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
  const { data: tags = [] } = useTags();
  // A Tag deleted meanwhile no longer narrows the list.
  const tagFilter = tags.some((item) => item.id === tag) ? tag : undefined;
  const shownTasks = tagFilter
    ? tasks.filter((task) => task.tags?.includes(tagFilter))
    : tasks;
  const [isProjectsDrawerOpen, setProjectsDrawerOpen] = useState(false);
  const {
    collapsed: collapsedStatuses,
    toggle: toggleStatusSection,
    expand: expandStatus,
  } = useCollapsedStatuses(selectedProject?.terminalStatus);

  function openTaskForm() {
    const defaultStatus = selectedProject
      ? initialNewTaskStatus(
          useNewTaskStatusStore.getState().lastStatusByProject,
          selectedProject.id,
          selectedProject.projectStatuses,
        )
      : "";
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
                  {shownTasks.length}{" "}
                  {shownTasks.length === 1 ? "ZADANIE" : "ZADAŃ"}
                </span>
                <IconButton
                  aria-label="Ustawienia listy zadań"
                  title="Ustawienia listy zadań"
                  onClick={() => ShowModal(TaskListSettingsModal)}
                >
                  <Settings size={20} aria-hidden="true" />
                </IconButton>
                <Button variant="primary" onClick={openTaskForm}>
                  <span aria-hidden="true">+</span>
                  Nowe zadanie
                </Button>
              </>
            }
          />

          {tags.length > 0 && (
            <TagFilter
              tags={tags}
              selected={tagFilter}
              onSelect={(next) =>
                void navigate({
                  to: ".",
                  search: (prev) => ({ ...prev, tag: next }),
                })
              }
            />
          )}
          {isTasksLoading ? (
            <LoadingStatus variant="inline">Wczytywanie zadań…</LoadingStatus>
          ) : isTasksError ? (
            <ErrorMessage>{TASKS_LOAD_ERROR}</ErrorMessage>
          ) : tasks.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">
              Nie ma tu jeszcze zadań.
            </p>
          ) : shownTasks.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">
              Żadne zadanie w tym projekcie nie ma tego tagu.
            </p>
          ) : (
            <TaskBoard
              project={selectedProject}
              tasks={shownTasks}
              allTasks={tasks}
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
