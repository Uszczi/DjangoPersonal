import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ReactNode } from "react";

import type { TaskResponse } from "@personal/shared/generated/api";

import { SortableTaskRow } from "./SortableTaskRow";

/** Drop target for a whole status, so a Task can land in an empty or collapsed-short list. */
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

/** One collapsible status heading with its sortable list of Tasks. */
export function TaskStatusSection({
  status,
  panelId,
  tasks,
  terminalStatus,
  isCollapsed,
  onToggleCollapsed,
  onToggleTaskStatus,
  onStartTimer,
  onEditTask,
}: {
  status: string;
  panelId: string;
  tasks: TaskResponse[];
  terminalStatus: string | null | undefined;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleTaskStatus: (task: TaskResponse) => void;
  onStartTimer: (task: TaskResponse) => void;
  onEditTask: (task: TaskResponse) => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <button
          className="flex w-full cursor-pointer items-center gap-2 rounded border border-transparent bg-transparent px-2 py-2 text-left transition-colors hover:bg-wash"
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={panelId}
          onClick={onToggleCollapsed}
        >
          <span className="text-[10px] text-muted" aria-hidden="true">
            {isCollapsed ? "▸" : "▾"}
          </span>
          <span className="text-[13px] font-semibold text-ink">{status}</span>
          <span className="text-[11px] text-muted">{tasks.length}</span>
        </button>
      </div>
      {!isCollapsed && (
        <div id={panelId}>
          <DroppableContainer id={status}>
            <ul className="flex flex-col" aria-label={status}>
              <SortableContext
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    isCompleted={
                      terminalStatus != null && task.status === terminalStatus
                    }
                    onToggleStatus={() => onToggleTaskStatus(task)}
                    onStartTimer={() => onStartTimer(task)}
                    onEdit={() => onEditTask(task)}
                  />
                ))}
              </SortableContext>
              {tasks.length === 0 && (
                <li className="py-4 text-center text-[13px] text-muted">
                  Brak w tym statusie.
                </li>
              )}
            </ul>
          </DroppableContainer>
        </div>
      )}
    </section>
  );
}
