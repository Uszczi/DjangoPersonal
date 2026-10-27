import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  Button,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { ProjectList } from "@/components/projects/ProjectList";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore } from "@personal/shared/stores/projects";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function openCreateForm() {
    ShowModal(ProjectEditorModal);
  }

  if (isLoading) {
    return <LoadingStatus>Wczytywanie projektów…</LoadingStatus>;
  }

  return (
    <>
      <PageHeader
        title="Projekty"
        actions={
          <Button variant="primary" onClick={openCreateForm}>
            <span aria-hidden="true">+</span>
            Nowy projekt
          </Button>
        }
      />

      {pageError && <ErrorMessage>{pageError}</ErrorMessage>}

      {projects.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak projektów.</p>
      ) : (
        <>
          <ProjectList
            projects={projects}
            onEdit={(project) => ShowModal(ProjectEditorModal, { project })}
          />
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={openCreateForm}>
              <span aria-hidden="true">+</span>
              Nowy projekt
            </Button>
          </div>
        </>
      )}
    </>
  );
}
