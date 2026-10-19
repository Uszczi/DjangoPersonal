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
      className={`flex min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]${isDragging ? " opacity-50" : ""}`}
    >
      {project.isInbox ? (
        <span
          className="inline-flex items-center justify-center text-[14px] text-[#9aafaa]"
          aria-hidden="true"
        />
      ) : (
        <span
          className="inline-flex cursor-grab items-center justify-center text-[14px] text-[#9aafaa] transition-colors hover:text-[#6c8082]"
          aria-label={`Przeciągnij projekt: ${project.name}`}
          title="Przeciągnij"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-snug text-ink">
          {project.name}
        </p>
        {project.description && (
          <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">
            {project.description}
          </small>
        )}
        {project.isInbox && (
          <span className="mt-1 inline-block rounded-full border border-signal bg-signal-pale px-2 py-0.5 text-[10px] font-semibold tracking-wide text-signal">
            DOMYŚLNY
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
          type="button"
          aria-label={`Edytuj projekt: ${project.name}`}
          onClick={onEdit}
        >
          Edytuj
        </button>
        {!project.isInbox && (
          <button
            className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#a23a28] transition-all hover:bg-[#f5e3dc] hover:text-[#872d1e]"
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
        <button
          className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
          onClick={openCreateForm}
        >
          <span aria-hidden="true">+</span>
          Nowy projekt
        </button>
      </div>

      {pageError && (
        <p className="py-4 text-[13px] text-[#a23a28]" role="alert">
          {pageError}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak projektów.</p>
      ) : (
        <>
          <ul className="flex flex-col" aria-label="Projekty">
            {inboxProject && (
              <li
                className="flex min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]"
                key={inboxProject.id}
              >
                <span
                  className="inline-flex items-center justify-center text-[14px] text-[#9aafaa]"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-snug text-ink">
                    {inboxProject.name}
                  </p>
                  {inboxProject.description && (
                    <small className="mt-0.5 block truncate text-[12px] leading-relaxed text-muted">
                      {inboxProject.description}
                    </small>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex min-h-[28px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-transparent px-[10px] text-[12px] font-semibold text-[#6c8082] transition-all hover:bg-[#f0f4f1] hover:text-ink"
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
          <div className="mt-4 flex justify-center">
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
              onClick={openCreateForm}
            >
              <span aria-hidden="true">+</span>
              Nowy projekt
            </button>
          </div>
        </>
      )}
    </>
  );
}
