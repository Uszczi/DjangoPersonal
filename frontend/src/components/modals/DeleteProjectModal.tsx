import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { ProjectResponse } from "@personal/shared/generated/api";
import {
  defaultProject,
  useDeleteProject,
  useProjects,
} from "@personal/shared/queries/projects";

type DeleteProjectModalProps = {
  project: ProjectResponse;
  onClose: () => void;
};

export function DeleteProjectModal({
  project,
  onClose,
}: DeleteProjectModalProps) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const deleteProject = useDeleteProject();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteProject.mutateAsync(project);
      const fallbackProject = defaultProject(
        projects.filter((item) => item.id !== project.id),
      );
      onClose();
      if (fallbackProject) {
        navigate({ to: "/tasks", search: { project: fallbackProject.id } });
      } else {
        navigate({ to: "/tasks" });
      }
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      kicker="POTWIERDŹ USUNIĘCIE"
      title="Usunąć projekt?"
      titleId="project-delete-title"
      onClose={close}
      size="md"
    >
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-body-soft break-words">
        Projekt „{project.name}" zostanie trwale usunięty wraz ze wszystkimi
        jego zadaniami.
      </p>
      {deleteError && <ErrorAlert>{deleteError}</ErrorAlert>}
      <ModalFooter>
        <Button variant="secondary" onClick={close} disabled={isDeleting}>
          Anuluj
        </Button>
        <Button
          variant="danger"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
        >
          {isDeleting ? "Usuwanie…" : "Usuń projekt"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
