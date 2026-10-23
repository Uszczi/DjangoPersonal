import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect, useRef } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

import { ModalHost } from "@/components/ModalHost";
import { Navbar } from "@/components/Navbar";
import { NotFoundPage } from "@/components/NotFoundPage";
import { useAuthStore } from "@/stores/auth";
import { authGuard } from "@/guards/auth";
import { rememberedProjectId, rememberProject } from "@/lastProject";
import { useProjectsStore } from "@/stores/projects";

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { project?: number } => ({
    project: typeof search.project === "number" ? search.project : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(["project"])],
  },
  beforeLoad: authGuard,
  component: App,
});

function App() {
  const { project } = useSearch({ from: "__root__" });
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  useEffect(() => {
    if (user) {
      void loadProjects();
    }
  }, [user, loadProjects]);

  // Remember the selected Project so a later session can reopen it.
  useEffect(() => {
    if (user && project !== undefined) {
      rememberProject(user.id, project);
    }
  }, [user, project]);

  // Restore the remembered Project on the first bare visit to /tasks in a
  // session. Later bare visits (e.g. the browser back button) still show the
  // default project.
  const restoreConsumed = useRef(false);
  useEffect(() => {
    if (restoreConsumed.current) return;
    if (!user || location.pathname !== "/tasks" || project !== undefined) return;
    if (isLoading) return;
    restoreConsumed.current = true;
    const remembered = rememberedProjectId(user.id);
    if (remembered !== null && projects.some((item) => item.id === remembered)) {
      void navigate({
        to: "/tasks",
        search: { project: remembered },
        replace: true,
      });
    }
  }, [user, location.pathname, project, isLoading, projects, navigate]);

  const projectNotFound =
    !isLoading &&
    !pageError &&
    project !== undefined &&
    !projects.some((item) => item.id === project);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 overflow-y-auto ${location.pathname.startsWith("/whiteboard") ? "bg-paper" : ""}`}>
          <div className="mx-auto w-full max-w-app">
            {projectNotFound ? <NotFoundPage /> : <Outlet />}
          </div>
        </main>
      </div>

      <ModalHost />
    </div>
  );
}

export default App;