import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect } from "react";
import { Link, Outlet, useSearch } from "@tanstack/react-router";

import { ModalHost } from "../components/ModalHost";
import { NotFoundPage } from "../components/NotFoundPage";
import { useProjectsStore } from "../stores/projects";
import "../App.css";

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { project?: number } => ({
    project: typeof search.project === "number" ? search.project : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(["project"])],
  },
  component: App,
});

type TopTabPath = "/" | "/tasks" | "/timer";

function TopTabLink({ to, children }: { to: TopTabPath; children: string }) {
  return (
    <Link
      className="topbar-tab"
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{
        className: "topbar-tab is-selected",
        "aria-current": "page",
      }}
    >
      {children}
    </Link>
  );
}

function App() {
  const { project } = useSearch({ from: "__root__" });

  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const projectNotFound =
    !isLoading &&
    !pageError &&
    project !== undefined &&
    !projects.some((item) => item.id === project);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link
          className="brand"
          to="/"
          aria-label="DjangoPersonal — strona główna"
        >
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>DjangoPersonal</span>
        </Link>
        <nav className="topbar-tabs" aria-label="Nawigacja widoków">
          <TopTabLink to="/">Start</TopTabLink>
          <TopTabLink to="/tasks">Zadania</TopTabLink>
          <TopTabLink to="/timer">Czas</TopTabLink>
        </nav>
      </header>

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
