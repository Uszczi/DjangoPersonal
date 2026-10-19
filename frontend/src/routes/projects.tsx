import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
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

import { DeleteProjectModal } from "@/components/DeleteProjectModal";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore } from "@/stores/projects";
import { api } from "@/api";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function SortableProjectRow({
  project,
  onEdit,
  onDelete,
}: {
  project: { id: number; name: string; description?: string; isInbox: boolean };
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
  } = useSortable({ id: project.id, disabled: project.isInbox });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`project-row${isDragging ? " is-dragging" : ""}`}
    >
      {project.isInbox ? (
        <span className="project-drag-handle" aria-hidden="true" />
      ) : (
        <span
          className="project-drag-handle"
          aria-label={`Przeciągnij projekt: ${project.name}`}
          title="Przeciągnij"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </span>
      )}
      <div className="project-row-copy">
        <p>{project.name}</p>
        {project.description && <small>{project.description}</small>}
        {project.isInbox && (
          <span className="project-tag">DOMYŚLNY</span>
        )}
      </div>
      <div className="project-row-actions">
        <button
          className="task-edit-button"
          type="button"
          aria-label={`Edytuj projekt: ${project.name}`}
          onClick={onEdit}
        >
          Edytuj
        </button>
        {!project.isInbox && (
          <button
            className="task-delete-button"
            type="button"
            aria-label={`Usuń projekt: ${project.name}`}
            onClick={onDelete}
          >
            Usuń
          </button>
        )}
      </div>
    </li>
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

  function openDeleteDialog(project: (typeof projects)[number]) {
    ShowModal(DeleteProjectModal, { project });
  }

  if (isLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie projektów…
      </div>
    );
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Projekty</h1>
        </div>
        <button className="primary-button" onClick={openCreateForm}>
          <span aria-hidden="true">+</span>
          Nowy projekt
        </button>
      </div>

      {pageError && (
        <p className="task-error" role="alert">
          {pageError}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="task-empty-state">Brak projektów.</p>
      ) : (
        <>
          <ul className="project-list" aria-label="Projekty">
            {inboxProject && (
              <li className="project-row" key={inboxProject.id}>
                <span className="project-drag-handle" aria-hidden="true" />
                <div className="project-row-copy">
                  <p>{inboxProject.name}</p>
                  {inboxProject.description && <small>{inboxProject.description}</small>}
                  <span className="project-tag">DOMYŚLNY</span>
                </div>
                <div className="project-row-actions">
                  <button
                    className="task-edit-button"
                    type="button"
                    aria-label={`Edytuj projekt: ${inboxProject.name}`}
                    onClick={() => openEditForm(inboxProject)}
                  >
                    Edytuj
                  </button>
                </div>
              </li>
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
                    onDelete={() => openDeleteDialog(project)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ul>
          <div className="list-add-row">
            <button className="primary-button" onClick={openCreateForm}>
              <span aria-hidden="true">+</span>
              Nowy projekt
            </button>
          </div>
        </>
      )}
    </>
  );
}
