import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  rectIntersection,
  getFirstCollision,
  pointerWithin,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import {
  Button,
  DragHandle,
  Drawer,
  ErrorMessage,
  IconButton,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { ProjectNavList, ProjectsSidebar } from "@/components/ProjectsSidebar";
import { TaskEditorModal } from "@/components/modals/TaskEditorModal";
import { rememberedProjectId, rememberProject } from "@/lastProject";
import { validateProjectSearch } from "@/projectSearch";
import { useAuthStore } from "@/stores/auth";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import { defaultProject, useProjectsStore } from "@/stores/projects";
import { useTasksStore } from "@/stores/tasks";
import { useSortSensors } from "@/useSortSensors";
import { api } from "@/api";
import type { TaskResponse } from "@/generated/api";

export const Route = createFileRoute("/tasks")({
  validateSearch: validateProjectSearch,
  component: TasksPage,
});

/** Keeps the `?project=` search param in step with the user's Projects.

The first bare visit in a session restores the remembered Project, a Project that exists is
remembered for later sessions, and one the user does not have (deleted,
someone else's, a typo) is dropped from the URL.
 */
function useProjectSearchParam(project: number | undefined) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);

  const known = projects.some((item) => item.id === project);
  const projectNotFound =
    !isLoading && !pageError && project !== undefined && !known;

  const isRestored = useProjectsStore(
    (state) => state.isRememberedProjectRestored,
  );
  const markRestored = useProjectsStore(
    (state) => state.markRememberedProjectRestored,
  );
  useEffect(() => {
    if (isRestored || !user || project !== undefined || isLoading) return;
    markRestored();
    const remembered = rememberedProjectId(user.id);
    if (
      remembered !== null &&
      projects.some((item) => item.id === remembered)
    ) {
      void navigate({
        to: "/tasks",
        search: { project: remembered },
        replace: true,
      });
    }
  }, [isRestored, markRestored, user, project, isLoading, projects, navigate]);

  useEffect(() => {
    if (user && project !== undefined && !isLoading && known) {
      rememberProject(user.id, project);
    }
  }, [user, project, isLoading, known]);

  useEffect(() => {
    if (!projectNotFound) return;
    void navigate({ to: "/tasks", search: {}, replace: true });
  }, [projectNotFound, navigate]);
}

function SortableTaskRow({
  task,
  isCompleted,
  onToggleStatus,
  onStartTimer,
  onEdit,
}: {
  task: TaskResponse;
  isCompleted: boolean;
  onToggleStatus: () => void;
  onStartTimer: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <ListRow
      ref={setNodeRef}
      style={style}
      className={isCompleted ? "opacity-60" : ""}
      data-task-id={task.id}
    >
      <>
        <DragHandle
          aria-label={`Przeciągnij zadanie: ${task.title}`}
          {...attributes}
          {...listeners}
        />
        <button
          className={`inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border p-0 text-[11px] text-white${isCompleted ? " border-[#668b79] bg-[#668b79]" : " border-[#9aafaa] bg-transparent"}`}
          type="button"
          data-completed={isCompleted ? true : undefined}
          aria-label={`${isCompleted ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
          onClick={onToggleStatus}
        >
          {isCompleted ? "✓" : ""}
        </button>
        <ListRowButton aria-label={`Edytuj zadanie: ${task.title}`} onClick={onEdit}>
          <div className="min-w-0">
            <ListRowTitle className={isCompleted ? "line-through" : ""}>{task.title}</ListRowTitle>
            {task.description && <ListRowSubtitle>{task.description}</ListRowSubtitle>}
          </div>
        </ListRowButton>
      </>
      <>
        <IconButton
          className="text-[14px] hover:text-ink"
          aria-label={`Uruchom timer: ${task.title}`}
          title="Uruchom timer"
          onClick={onStartTimer}
        >
          <span aria-hidden="true">▶</span>
        </IconButton>
      </>
    </ListRow>
  );
}

function DroppableContainer({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${id}`,
    data: { status: id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: isOver ? "120px" : undefined,
        transition: "min-height 0.15s ease",
      }}
    >
      {children}
    </div>
  );
}

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
  const terminalStatus = selectedProject?.terminalStatus;

  useEffect(() => {
    if (selectedProjectId === null) return;
    void loadTasks(selectedProjectId);
  }, [loadTasks, selectedProjectId]);

  const tasks = taskList?.projectId === selectedProjectId ? taskList.tasks : [];
  const [isProjectsDrawerOpen, setProjectsDrawerOpen] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<
    ReadonlySet<string>
  >(new Set());

  const sensors = useSortSensors();

  // Custom collision detection for multi-container sorting
  const collisionDetection: CollisionDetection = (args) => {
    const pointerIntersections = pointerWithin(args);
    const rectIntersections = rectIntersection(args);

    // First, try pointerWithin for precise detection
    let collision = getFirstCollision(pointerIntersections, "id");
    if (collision) return [{ id: collision }];

    // Fall back to rectIntersection
    collision = getFirstCollision(rectIntersections, "id");
    if (collision) return [{ id: collision }];

    return [];
  };

  function handleDragStart(_event: DragStartEvent) {
    // no-op
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { status?: string } | undefined;
    const overData = over.data.current as { status?: string } | undefined;

    const activeStatus = activeData?.status;
    const overStatus = overData?.status;

    if (!activeStatus || !overStatus || activeStatus === overStatus) return;

    // Move the task to the new container in local state
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Update local state to reflect the move
    const updatedTasks = tasks.map((t) =>
      t.id === active.id ? { ...t, status: overStatus } : t,
    );
    useTasksStore.setState({
      taskList: {
        projectId: selectedProjectId!,
        tasks: updatedTasks,
      },
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id || selectedProjectId === null) return;

    const draggedTask = tasks.find((task) => task.id === active.id);
    if (!draggedTask) return;

    const overData = over.data.current as { status?: string } | undefined;
    const overStatus = overData?.status;
    if (!overStatus) return;

    const isSameGroup = draggedTask.status === overStatus;
    const targetGroupTasks = tasks.filter((task) => task.status === overStatus);
    const overTask = targetGroupTasks.find((task) => task.id === over.id);

    let newIndex: number;
    if (overTask) {
      newIndex = targetGroupTasks.findIndex((task) => task.id === over.id);
    } else {
      newIndex = targetGroupTasks.length;
    }

    try {
      await api.tasksPartialUpdate({
        id: Number(active.id),
        patchedTaskUpdateRequest: {
          ...(isSameGroup ? {} : { status: overStatus }),
          position: newIndex,
        },
      });
      await loadTasks(selectedProjectId);
    } catch {
      await loadTasks(selectedProjectId);
    }
  }

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

  function openTaskEditForm(task: TaskResponse) {
    ShowModal(TaskEditorModal, { task });
  }

  async function startTimer(task: TaskResponse) {
    if (await startTaskTimer(task)) {
      navigate({ to: "/timer", search: { project: selectedProjectId ?? undefined } });
    }
  }

  if (isProjectsLoading) {
    return (
      <LoadingStatus>
        Wczytywanie projektów…
      </LoadingStatus>
    );
  }

  if (!selectedProject) {
    return (
      <div className="pt-[40px] text-muted">
        <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK PROJEKTÓW</p>
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Utwórz pierwsze miejsce pracy</h1>
        <Button
          variant="primary"
          className="mt-5"
          onClick={() => ShowModal(ProjectEditorModal)}
        >
          Nowy projekt
        </Button>
      </div>
    );
  }

  // Tasks already arrive ordered by status, so grouping them here preserves
  // the project's status order. Unknown statuses (e.g. removed from the
  // project) land after the known ones, grouped by first appearance.
  const statusGroups = new Map<string, TaskResponse[]>();
  for (const status of selectedProject.projectStatuses) {
    statusGroups.set(status, []);
  }
  for (const task of tasks) {
    const group = statusGroups.get(task.status);
    if (group) {
      group.push(task);
    } else {
      statusGroups.set(task.status, [task]);
    }
  }

  const statusSections = [...statusGroups].map(
    ([status, statusTasks], index) => {
      const isCollapsed = collapsedStatuses.has(status);
      return (
        <section key={status}>
          <div className="flex items-center justify-between">
            <button
              className="flex w-full cursor-pointer items-center gap-2 rounded border border-transparent bg-transparent px-2 py-2 text-left transition-colors hover:bg-wash"
              type="button"
              aria-expanded={!isCollapsed}
              aria-controls={`status-section-panel-${index}`}
              onClick={() => toggleStatusSection(status)}
            >
              <span className="text-[10px] text-muted" aria-hidden="true">
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span className="text-[13px] font-semibold text-ink">{status}</span>
              <span className="text-[11px] text-muted">
                {statusTasks.length}
              </span>
            </button>
          </div>
          {!isCollapsed && (
            <div id={`status-section-panel-${index}`}>
              <DroppableContainer id={status}>
                <ul className="flex flex-col" aria-label={status}>
                  <SortableContext
                    items={statusTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {statusTasks.map((task) => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        isCompleted={
                          terminalStatus != null && task.status === terminalStatus
                        }
                        onToggleStatus={() => void toggleTaskStatus(task)}
                        onStartTimer={() => void startTimer(task)}
                        onEdit={() => openTaskEditForm(task)}
                      />
                    ))}
                  </SortableContext>
                  {statusTasks.length === 0 && (
                    <li className="py-4 text-center text-[13px] text-muted">Brak w tym statusie.</li>
                  )}
                </ul>
              </DroppableContainer>
            </div>
          )}
        </section>
      );
    },
  );

  const tasksError =
    loadError?.projectId === selectedProjectId ? loadError.message : "";
  const isTasksLoading =
    selectedProjectId !== null &&
    taskList?.projectId !== selectedProjectId &&
    loadError?.projectId !== selectedProjectId;

  return (
    <>
      {isProjectsDrawerOpen && (
        <Drawer
          id="projects-drawer"
          label="Projekty"
          title={
            <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
              Projekty
            </h2>
          }
          onClose={() => setProjectsDrawerOpen(false)}
        >
          <ProjectNavList
            selectedProjectId={selectedProjectId}
            tone="light"
            onNavigate={() => setProjectsDrawerOpen(false)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setProjectsDrawerOpen(false);
              ShowModal(ProjectEditorModal);
            }}
          >
            <span aria-hidden="true">+</span>
            Nowy projekt
          </Button>
        </Drawer>
      )}
      <div className="flex flex-1 gap-8">
        <ProjectsSidebar
          selectedProjectId={selectedProjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="tasks-heading">
          <PageHeader
            title="Zadania"
            titleId="tasks-heading"
            subtitle={<span title="Aktualny projekt">{selectedProject.name}</span>}
            leading={
              /* Small screens have no sidebar; the Projects open in a drawer. */
              <button
                className="inline-flex cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-muted transition-all hover:-translate-y-px hover:text-ink md:hidden"
                aria-label="Pokaż projekty"
                title="Pokaż projekty"
                aria-haspopup="dialog"
                aria-expanded={isProjectsDrawerOpen}
                aria-controls="projects-drawer"
                onClick={() => setProjectsDrawerOpen(true)}
              >
                <span aria-hidden="true">»</span>
              </button>
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
            <LoadingStatus variant="inline">
              Wczytywanie zadań…
            </LoadingStatus>
          ) : tasksError ? (
            <ErrorMessage>
              {tasksError}
            </ErrorMessage>
          ) : tasks.length === 0 ? (
            <p className="py-4 text-[13px] text-muted">Nie ma tu jeszcze zadań.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {}}
            >
              {statusSections}
            </DndContext>
          )}
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={openTaskForm}>
              <span aria-hidden="true">+</span>
              Nowe zadanie
            </Button>
          </div>
          {actionError && (
            <ErrorMessage>
              {actionError}
            </ErrorMessage>
          )}
        </section>
      </div>
    </>
  );
}