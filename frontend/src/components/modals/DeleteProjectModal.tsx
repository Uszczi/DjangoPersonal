import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "@/apiErrorMessage";
import { Button, ErrorAlert, Modal, ModalFooter } from "@/design-system";
import type { ProjectResponse } from "@/generated/api";
import { useProjectsStore } from "@/stores/projects";

type DeleteProjectModalProps = {
  project: ProjectResponse;
  onClose: () => void;
};

export function DeleteProjectModal({
  project,
  onClose,
}: DeleteProjectModalProps) {
  const navigate = useNavigate();
  const confirmProjectDelete = useProjectsStore(
    (state) => state.confirmProjectDelete,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const fallbackProject = await confirmProjectDelete(project);
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
      <p className="m-0 mt-5 text-[13px] leading-relaxed text-[#40595c] break-words">
        Projekt „{project.name}" zostanie trwale usunięty wraz ze wszystkimi
        jego zadaniami.
      </p>
      {deleteError && <ErrorAlert>{deleteError}</ErrorAlert>}
      <ModalFooter>
        <Button
          variant="secondary"
          onClick={close}
          disabled={isDeleting}
        >
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
