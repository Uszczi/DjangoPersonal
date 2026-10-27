import { createFileRoute } from "@tanstack/react-router";

import {
  Button,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { ProjectList } from "@/components/projects/ProjectList";
import { ShowModal } from "@/stores/modal";
import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [], isPending, isError } = useProjects();

  function openCreateForm() {
    ShowModal(ProjectEditorModal);
  }

  if (isPending) {
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

      {isError && <ErrorMessage>{PROJECTS_LOAD_ERROR}</ErrorMessage>}

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
