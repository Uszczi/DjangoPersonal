import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { rememberedProjectId, rememberProject } from "@/lib/lastProject";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useProjects } from "@personal/shared/queries/projects";
import { useProjectSelectionStore } from "@/stores/projectSelection";

/** Keeps the `?project=` search param of `/tasks` in step with the user's Projects.

The first bare visit in a session restores the remembered Project, a Project that exists is
remembered for later sessions, and one the user does not have (deleted,
someone else's, a typo) is dropped from the URL.
 */
export function useProjectSearchParam(project: number | undefined) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: projects = [], isPending: isLoading, isError } = useProjects();

  const known = projects.some((item) => item.id === project);
  const projectNotFound =
    !isLoading && !isError && project !== undefined && !known;

  const isRestored = useProjectSelectionStore(
    (state) => state.isRememberedProjectRestored,
  );
  const markRestored = useProjectSelectionStore(
    (state) => state.markRememberedProjectRestored,
  );
  useEffect(() => {
    if (isRestored || !user || project !== undefined || isLoading) return;
    markRestored();
    const remembered = rememberedProjectId(user.id);
    if (
      remembered !== null &&
      projects.some((item) => item.id === remembered)
    ) {
      void navigate({
        to: "/tasks",
        search: { project: remembered },
        replace: true,
      });
    }
  }, [isRestored, markRestored, user, project, isLoading, projects, navigate]);

  useEffect(() => {
    if (user && project !== undefined && !isLoading && known) {
      rememberProject(user.id, project);
    }
  }, [user, project, isLoading, known]);

  useEffect(() => {
    if (!projectNotFound) return;
    void navigate({ to: "/tasks", search: {}, replace: true });
  }, [projectNotFound, navigate]);
}
