import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare } from "lucide-react";

import {
  DragHandle,
  IconButton,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import type { TaskResponse } from "@personal/shared/generated/api";
import { useTaskListSettingsStore } from "@personal/shared/stores/taskListSettings";
import { commentCountLabel } from "@personal/shared/queries/taskComments";
import { shortTaskTitle } from "@personal/shared/taskTitle";

/** One Task in its status list: drag handle, done checkbox, title (opens the editor), timer start (unless turned off in the list's settings). */
export function SortableTaskRow({
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
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const showCommentCount = useTaskListSettingsStore(
    (state) => state.showCommentCount,
  );
  const commentCount = task.commentCount ?? 0;

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
          className={`inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border p-0 text-[11px] text-on-signal${isCompleted ? " border-done bg-done" : " border-drag-handle bg-transparent"}`}
          type="button"
          data-completed={isCompleted ? true : undefined}
          aria-label={`${isCompleted ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
          onClick={onToggleStatus}
        >
          {isCompleted ? "✓" : ""}
        </button>
        <ListRowButton
          aria-label={`Edytuj zadanie: ${task.title}`}
          onClick={onEdit}
        >
          <div className="min-w-0">
            <ListRowTitle className={isCompleted ? "line-through" : ""}>
              {shortTaskTitle(task.title)}
            </ListRowTitle>
            {task.description && (
              <ListRowSubtitle>{task.description}</ListRowSubtitle>
            )}
          </div>
        </ListRowButton>
      </>
      <>
        {showCommentCount && commentCount > 0 && (
          <span
            className="mr-1 inline-flex shrink-0 items-center gap-1 text-[12px] text-muted tabular-nums"
            title={commentCountLabel(commentCount)}
            aria-label={commentCountLabel(commentCount)}
          >
            <MessageSquare size={14} aria-hidden="true" />
            {commentCount}
          </span>
        )}
        {showTimerButton && (
          <IconButton
            className="text-[14px] hover:text-ink"
            aria-label={`Uruchom timer: ${task.title}`}
            title="Uruchom timer"
            onClick={onStartTimer}
          >
            <span aria-hidden="true">▶</span>
          </IconButton>
        )}
      </>
    </ListRow>
  );
}
