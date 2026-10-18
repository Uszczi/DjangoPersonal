import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect } from "react";
import { Outlet, useSearch } from "@tanstack/react-router";

import { ModalHost } from "@/components/ModalHost";
import { Navbar } from "@/components/Navbar";
import { NotFoundPage } from "@/components/NotFoundPage";
import { useAuthStore } from "@/stores/auth";
import { authGuard } from "@/guards/auth";
import { useProjectsStore } from "@/stores/projects";
import "@/App.css";

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

  const projectNotFound =
    !isLoading &&
    !pageError &&
    project !== undefined &&
    !projects.some((item) => item.id === project);

  return (
    <div className="app-shell">
      <Navbar />

      <div className="workspace">
        <main className="main-panel">
          {projectNotFound ? <NotFoundPage /> : <Outlet />}
        </main>
      </div>

      <ModalHost />
    </div>
  );
}

export default App;