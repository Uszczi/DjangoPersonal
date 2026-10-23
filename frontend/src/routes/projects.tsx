import { createFileRoute } from "@tanstack/react-router";
import { useEffect, type ComponentProps, type HTMLAttributes } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Button,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore } from "@/stores/projects";
import { api } from "@/api";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

type ProjectRowProject = {
  id: number;
  name: string;
  description?: string;
  isInbox: boolean;
};

type ProjectRowProps = {
  project: ProjectRowProject;
  onEdit: () => void;
  /** The drag handle's dnd-kit props; the Inbox, which never moves, has none. */
  dragHandle?: HTMLAttributes<HTMLSpanElement>;
} & Pick<ComponentProps<typeof ListRow>, "ref" | "style">;

function ProjectRow({ project, onEdit, dragHandle, ref, style }: ProjectRowProps) {
  return (
    <ListRow ref={ref} style={style}>
      <>
        {dragHandle ? (
          <span
            className="inline-flex cursor-grab items-center justify-center text-[14px] text-[#9aafaa] transition-colors hover:text-muted"
            aria-label={`Przeciągnij projekt: ${project.name}`}
            title="Przeciągnij"
            {...dragHandle}
          >
            <span aria-hidden="true">⠿</span>
          </span>
        ) : (
          <span className="inline-block w-[14px]" aria-hidden="true" />
        )}
        <ListRowButton aria-label={`Edytuj projekt: ${project.name}`} onClick={onEdit}>
          <div className="min-w-0">
            <ListRowTitle>{project.name}</ListRowTitle>
            {project.description && <ListRowSubtitle>{project.description}</ListRowSubtitle>}
            {project.isInbox && (
              <span className="mt-1 inline-block rounded-full border border-signal bg-signal-pale px-2 py-0.5 text-[10px] font-semibold tracking-wide text-signal">
                DOMYŚLNY
              </span>
            )}
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

export function ProjectsPage() {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

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

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
      await loadProjects();
    } catch {
      await loadProjects();
    }
  }

  function openCreateForm() {
    ShowModal(ProjectEditorModal);
  }

  function openEditForm(project: (typeof projects)[number]) {
    ShowModal(ProjectEditorModal, { project });
  }

  if (isLoading) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie projektów…
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">
            Projekty
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={openCreateForm}
        >
          <span aria-hidden="true">+</span>
          Nowy projekt
        </Button>
      </div>

      {pageError && (
        <p className="py-4 text-[13px] text-danger" role="alert">
          {pageError}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak projektów.</p>
      ) : (
        <>
          <ul className="flex flex-col" aria-label="Projekty">
            {inboxProject && (
              <ProjectRow
                project={inboxProject}
                onEdit={() => openEditForm(inboxProject)}
              />
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {}}
            >
              <SortableContext
                items={sortableProjects.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortableProjects.map((project) => (
                  <SortableProjectRow
                    key={project.id}
                    project={project}
                    onEdit={() => openEditForm(project)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ul>
          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              onClick={openCreateForm}
            >
              <span aria-hidden="true">+</span>
              Nowy projekt
            </Button>
          </div>
        </>
      )}
    </>
  );
}
