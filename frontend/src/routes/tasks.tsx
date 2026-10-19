import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import { DeleteTaskModal } from "@/components/DeleteTaskModal";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { TaskEditorModal } from "@/components/TaskEditorModal";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import { defaultProject, useProjectsStore } from "@/stores/projects";
import { useTasksStore } from "@/stores/tasks";
import { api } from "@/api";
import type { TaskResponse } from "@/generated/api";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function SortableTaskRow({
  task,
  isCompleted,
  onToggleStatus,
  onStartTimer,
  onEdit,
  onDelete,
}: {
  task: TaskResponse;
  isCompleted: boolean;
  onToggleStatus: () => void;
  onStartTimer: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`task-row${isCompleted ? " is-completed" : ""}${isDragging ? " is-dragging" : ""}`}
      data-task-id={task.id}
    >
      <span
        className="task-drag-handle"
        aria-label={`Przeciągnij zadanie: ${task.title}`}
        title="Przeciągnij"
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </span>
      <button
        className={`task-status-toggle${isCompleted ? " is-completed" : ""}`}
        type="button"
        aria-label={`${isCompleted ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
        onClick={onToggleStatus}
      >
        {isCompleted ? "✓" : ""}
      </button>
      <div className="task-copy">
        <p>{task.title}</p>
        {task.description && <small>{task.description}</small>}
      </div>
      <div className="task-row-actions">
        <button
          className="task-timer-button"
          type="button"
          aria-label={`Uruchom timer: ${task.title}`}
          title="Uruchom timer"
          onClick={onStartTimer}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          className="task-edit-button"
          type="button"
          aria-label={`Edytuj zadanie: ${task.title}`}
          onClick={onEdit}
        >
          Edytuj
        </button>
        <button
          className="task-delete-button"
          type="button"
          aria-label={`Usuń zadanie: ${task.title}`}
          onClick={onDelete}
        >
          Usuń
        </button>
      </div>
    </li>
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

export function TasksPage() {
  const { project } = useSearch({ from: "__root__" });
  const navigate = useNavigate();

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
  const [collapsedStatuses, setCollapsedStatuses] = useState<
    ReadonlySet<string>
  >(new Set());


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  function openTaskDeleteDialog(task: TaskResponse) {
    ShowModal(DeleteTaskModal, { task });
  }

  async function startTimer(task: TaskResponse) {
    if (await startTaskTimer(task)) {
      navigate({ to: "/timer" });
    }
  }

  if (isProjectsLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie projektów…
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="empty-state">
        <p className="eyebrow">BRAK PROJEKTÓW</p>
        <h1>Utwórz pierwsze miejsce pracy</h1>
        <button
          className="primary-button"
          onClick={() => ShowModal(ProjectEditorModal)}
        >
          Nowy projekt
        </button>
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
        <section className="status-section" key={status}>
          <div className="status-section-header">
            <button
              className="status-section-toggle"
              type="button"
              aria-expanded={!isCollapsed}
              aria-controls={`status-section-panel-${index}`}
              onClick={() => toggleStatusSection(status)}
            >
              <span className="status-section-chevron" aria-hidden="true">
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span className="status-section-name">{status}</span>
              <span className="status-section-count">
                {statusTasks.length}
              </span>
            </button>
          </div>
          {!isCollapsed && (
            <div id={`status-section-panel-${index}`}>
              <DroppableContainer id={status}>
                <ul className="task-list" aria-label={status}>
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
                        onDelete={() => openTaskDeleteDialog(task)}
                      />
                    ))}
                  </SortableContext>
                  {statusTasks.length === 0 && (
                    <li className="task-empty-state">Brak w tym statusie.</li>
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
      <div
        className={`tasks-layout${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
      >
        <ProjectsSidebar
          selectedProjectId={selectedProjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="task-section-heading">
            <div>
              <button className="sidebar-open-button" onClick={toggleSidebar}>
                <span aria-hidden="true">{isSidebarCollapsed ? "»" : "«"}</span>
              </button>
              <h2 id="tasks-heading">Zadania</h2>
              <span className="task-project-name" title="Aktualny projekt">
                {selectedProject.name}
              </span>
            </div>
            <div className="task-heading-actions">
              <span className="task-count">
                {tasks.length} {tasks.length === 1 ? "ZADANIE" : "ZADAŃ"}
              </span>
              <button
                className="primary-button new-task-button"
                onClick={openTaskForm}
              >
                <span aria-hidden="true">+</span>
                Nowe zadanie
              </button>
            </div>
          </div>

          {isTasksLoading ? (
            <p className="task-message" role="status">
              Wczytywanie zadań…
            </p>
          ) : tasksError ? (
            <p className="task-error" role="alert">
              {tasksError}
            </p>
          ) : tasks.length === 0 ? (
            <p className="task-empty-state">Nie ma tu jeszcze zadań.</p>
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
          <div className="list-add-row">
            <button className="quiet-button" onClick={openTaskForm}>
              <span aria-hidden="true">+</span>
              Nowe zadanie
            </button>
          </div>
          {actionError && (
            <p className="task-error" role="alert">
              {actionError}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
