import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentProps, HTMLAttributes } from "react";

import {
  DragHandle,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import { useSortSensors } from "@/lib/useSortSensors";
import { api } from "@personal/shared/api";
import type { ProjectResponse } from "@personal/shared/generated/api";
import { useProjectsStore } from "@personal/shared/stores/projects";

type ProjectRowProps = {
  project: ProjectResponse;
  onEdit: () => void;
  /** The drag handle's dnd-kit props; the Inbox, which never moves, has none. */
  dragHandle?: HTMLAttributes<HTMLSpanElement>;
} & Pick<ComponentProps<typeof ListRow>, "ref" | "style">;

function ProjectRow({ project, onEdit, dragHandle, ref, style }: ProjectRowProps) {
  return (
    <ListRow ref={ref} style={style}>
      <>
        {dragHandle ? (
          <DragHandle aria-label={`Przeciągnij projekt: ${project.name}`} {...dragHandle} />
        ) : (
          <span className="inline-block w-[14px]" aria-hidden="true" />
        )}
        <ListRowButton aria-label={`Edytuj projekt: ${project.name}`} onClick={onEdit}>
          <div className="min-w-0">
            <ListRowTitle>{project.name}</ListRowTitle>
            {project.description && <ListRowSubtitle>{project.description}</ListRowSubtitle>}
          </div>
        </ListRowButton>
      </>
      {null}
    </ListRow>
  );
}

function SortableProjectRow(props: Omit<ProjectRowProps, "dragHandle" | "ref" | "style">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.project.id });

  return (
    <ProjectRow
      {...props}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      dragHandle={{ ...attributes, ...listeners }}
    />
  );
}

/** The user's Projects: the Inbox pinned first, the rest reorderable by dragging. */
export function ProjectList({
  projects,
  onEdit,
}: {
  projects: ProjectResponse[];
  onEdit: (project: ProjectResponse) => void;
}) {
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const sensors = useSortSensors();

  const sortableProjects = projects.filter((p) => !p.isInbox);
  const inboxProject = projects.find((p) => p.isInbox);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortableProjects.findIndex((p) => p.id === active.id);
    const newIndex = sortableProjects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortableProjects, oldIndex, newIndex);
    const targetIndex = reordered.findIndex((p) => p.id === active.id);

    try {
      await api.projectsPartialUpdate({
        id: Number(active.id),
        patchedProjectRequest: { position: targetIndex },
      });
    } catch {
      // The reload below puts the Project back where the server has it.
    }
    await loadProjects();
  }

  return (
    <ul className="flex flex-col" aria-label="Projekty">
      {inboxProject && (
        <ProjectRow project={inboxProject} onEdit={() => onEdit(inboxProject)} />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortableProjects.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortableProjects.map((project) => (
            <SortableProjectRow
              key={project.id}
              project={project}
              onEdit={() => onEdit(project)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </ul>
  );
}
