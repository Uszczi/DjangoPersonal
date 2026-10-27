import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";

import { useSortSensors } from "@/lib/useSortSensors";
import type {
  ProjectResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import {
  updateProjectTasks,
  useMoveTask,
} from "@personal/shared/queries/tasks";
import { useQueryClient } from "@tanstack/react-query";

import { TaskStatusSection } from "./TaskStatusSection";

// Pointer first, then rectangles: lets a Task move between status lists, not only within one.
const collisionDetection: CollisionDetection = (args) => {
  let collision = getFirstCollision(pointerWithin(args), "id");
  if (collision) return [{ id: collision }];

  collision = getFirstCollision(rectIntersection(args), "id");
  if (collision) return [{ id: collision }];

  return [];
};

/**
 * Groups a Project's Tasks by status. Tasks already arrive ordered by status, so this
 * preserves the Project's status order; unknown statuses (e.g. removed from the Project)
 * land after the known ones, grouped by first appearance.
 */
function groupByStatus(project: ProjectResponse, tasks: TaskResponse[]) {
  const groups = new Map<string, TaskResponse[]>();
  for (const status of project.projectStatuses) {
    groups.set(status, []);
  }
  for (const task of tasks) {
    const group = groups.get(task.status);
    if (group) {
      group.push(task);
    } else {
      groups.set(task.status, [task]);
    }
  }
  return [...groups];
}

/** A Project's Tasks as status sections; dragging reorders them or changes their status. */
export function TaskBoard({
  project,
  tasks,
  collapsedStatuses,
  onToggleCollapsed,
  onToggleTaskStatus,
  onStartTimer,
  onEditTask,
}: {
  project: ProjectResponse;
  tasks: TaskResponse[];
  collapsedStatuses: ReadonlySet<string>;
  onToggleCollapsed: (status: string) => void;
  onToggleTaskStatus: (task: TaskResponse) => void;
  onStartTimer: (task: TaskResponse) => void;
  onEditTask: (task: TaskResponse) => void;
}) {
  const queryClient = useQueryClient();
  const moveTask = useMoveTask();
  const sensors = useSortSensors();

  // Moves the Task into the hovered status list right away, so it is shown there while dragging.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeStatus = (
      active.data.current as { status?: string } | undefined
    )?.status;
    const overStatus = (over.data.current as { status?: string } | undefined)
      ?.status;
    if (!activeStatus || !overStatus || activeStatus === overStatus) return;

    if (!tasks.some((t) => t.id === active.id)) return;

    updateProjectTasks(queryClient, project.id, (cached) =>
      cached.map((t) =>
        t.id === active.id ? { ...t, status: overStatus } : t,
      ),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedTask = tasks.find((task) => task.id === active.id);
    if (!draggedTask) return;

    const overStatus = (over.data.current as { status?: string } | undefined)
      ?.status;
    if (!overStatus) return;

    const isSameGroup = draggedTask.status === overStatus;
    const targetGroupTasks = tasks.filter((task) => task.status === overStatus);
    const overIndex = targetGroupTasks.findIndex((task) => task.id === over.id);
    const newIndex = overIndex === -1 ? targetGroupTasks.length : overIndex;

    // The list is reloaded either way, so a refused move snaps back.
    moveTask.mutate({
      task: draggedTask,
      position: newIndex,
      status: isSameGroup ? undefined : overStatus,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {groupByStatus(project, tasks).map(([status, statusTasks], index) => (
        <TaskStatusSection
          key={status}
          status={status}
          panelId={`status-section-panel-${index}`}
          tasks={statusTasks}
          terminalStatus={project.terminalStatus}
          isCollapsed={collapsedStatuses.has(status)}
          onToggleCollapsed={() => onToggleCollapsed(status)}
          onToggleTaskStatus={onToggleTaskStatus}
          onStartTimer={onStartTimer}
          onEditTask={onEditTask}
        />
      ))}
    </DndContext>
  );
}
