import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  DragHandle,
  IconButton,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import type { TaskResponse } from "@personal/shared/generated/api";

/** One Task in its status list: drag handle, done checkbox, title (opens the editor), timer start. */
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
