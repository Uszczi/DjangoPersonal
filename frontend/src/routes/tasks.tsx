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
      className={`grid min-h-[62px] grid-cols-[24px_18px_minmax(0,1fr)_auto] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]${isCompleted ? " opacity-60" : ""}${isDragging ? " opacity-50" : ""}`}
      data-task-id={task.id}
    >
      <span
        className="inline-flex cursor-grab items-center justify-center text-[14px] text-[#9aafaa] transition-colors hover:text-[#6c8082]"
        aria-label={`Przeciągnij zadanie: ${task.title}`}
        title="Przeciągnij"
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </span>
      <button
        className={`inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded border p-0 text-[11px] text-white${isCompleted ? " border-[#668b79] bg-[#668b79]" : " border-[#9aafaa] bg-transparent"}`}
        type="button"
        data-completed={isCompleted ? true : undefined}
        aria-label={`${isCompleted ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
        onClick={onToggleStatus}
      >
        {isCompleted ? "✓" : ""}
      </button>
      <div className="min-w-0">
        <p className={`truncate text-[14px] font-medium leading-snug text-ink ${isCompleted ? "line-through" : ""}`}>
          {task.title}
        </p>
        {task.description && (
          <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">
            {task.description}
          </small>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex h-[28px] items-center justify-center rounded border border-transparent bg-transparent px-2 text-[16px] text-[#6c8082] transition-colors hover:bg-[#f0f4f1] hover:text-ink cursor-pointer"
          type="button"
          aria-label={`Uruchom timer: ${task.title}`}
          title="Uruchom timer"
          onClick={onStartTimer}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
          type="button"
          aria-label={`Edytuj zadanie: ${task.title}`}
          onClick={onEdit}
        >
          Edytuj
        </button>
        <button
          className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#a23a28] transition-all hover:bg-[#f5e3dc] hover:text-[#872d1e]"
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
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie projektów…
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="pt-[40px] text-muted">
        <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK PROJEKTÓW</p>
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Utwórz pierwsze miejsce pracy</h1>
        <button
          className="mt-5 inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
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
        <section key={status}>
          <div className="flex items-center justify-between">
            <button
              className="flex w-full cursor-pointer items-center gap-2 rounded border border-transparent bg-transparent px-2 py-2 text-left transition-colors hover:bg-[#f0f4f1]"
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
                        onDelete={() => openTaskDeleteDialog(task)}
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
      <div className={`flex flex-1 ${isSidebarCollapsed ? "" : ""}`}>
        <ProjectsSidebar
          selectedProjectId={selectedProjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <section className="flex flex-1 flex-col p-8" aria-labelledby="tasks-heading">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-[#6c8082] transition-all hover:-translate-y-px cursor-pointer hover:text-ink"
                onClick={toggleSidebar}
              >
                <span aria-hidden="true">{isSidebarCollapsed ? "»" : "«"}</span>
              </button>
              <h2 id="tasks-heading" className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Zadania</h2>
              <span className="text-[13px] text-muted" title="Aktualny projekt">
                {selectedProject.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
                {tasks.length} {tasks.length === 1 ? "ZADANIE" : "ZADAŃ"}
              </span>
              <button
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                onClick={openTaskForm}
              >
                <span aria-hidden="true">+</span>
                Nowe zadanie
              </button>
            </div>
          </div>

          {isTasksLoading ? (
            <p className="py-4 text-[13px] text-muted" role="status">
              Wczytywanie zadań…
            </p>
          ) : tasksError ? (
            <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
              {tasksError}
            </p>
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
          <div className="mt-4">
            <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap" onClick={openTaskForm}>
              <span aria-hidden="true">+</span>
              Nowe zadanie
            </button>
          </div>
          {actionError && (
            <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
              {actionError}
            </p>
          )}
        </section>
      </div>
    </>
  );
}