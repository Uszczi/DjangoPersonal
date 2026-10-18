import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DeleteProjectModal } from "@/components/DeleteProjectModal";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore } from "@/stores/projects";
import { api } from "@/api";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

export function ProjectsPage() {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleProjectDrop(targetId: number) {
    if (draggedId === null || draggedId === targetId) return;
    const draggedProject = projects.find((project) => project.id === draggedId);
    const targetProject = projects.find((project) => project.id === targetId);
    if (!draggedProject || !targetProject) return;
    if (draggedProject.isInbox || targetProject.isInbox) return;

    const siblings = projects.filter((project) => !project.isInbox);
    const targetIndex = siblings.findIndex((project) => project.id === targetId);

    setDraggedId(null);
    setDragOverId(null);

    try {
      await api.projectsPartialUpdate({
        id: draggedId,
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
          {projects.map((project) => (
            <li
              className={`project-row${draggedId === project.id ? " is-dragging" : ""}${dragOverId === project.id ? " is-drag-over" : ""}`}
              key={project.id}
              draggable={!project.isInbox}
              onDragStart={() => {
                if (!project.isInbox) setDraggedId(project.id);
              }}
              onDragOver={(event) => {
                if (project.isInbox) return;
                event.preventDefault();
                setDragOverId(project.id);
              }}
              onDrop={() => void handleProjectDrop(project.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
            >
              {project.isInbox ? (
                <span className="project-drag-handle" aria-hidden="true" />
              ) : (
                <span
                  className="project-drag-handle"
                  aria-label={`Przeciągnij projekt: ${project.name}`}
                  title="Przeciągnij"
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
                  onClick={() => openEditForm(project)}
                >
                  Edytuj
                </button>
                {!project.isInbox && (
                  <button
                    className="task-delete-button"
                    type="button"
                    aria-label={`Usuń projekt: ${project.name}`}
                    onClick={() => openDeleteDialog(project)}
                  >
                    Usuń
                  </button>
                )}
              </div>
            </li>
          ))}
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