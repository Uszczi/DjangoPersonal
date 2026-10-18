import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";

import { ModalHost } from "@/components/ModalHost";
import { Navbar } from "@/components/Navbar";
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
  const user = useAuthStore((state) => state.user);
  const loadProjects = useProjectsStore((state) => state.loadProjects);

  useEffect(() => {
    if (user) {
      void loadProjects();
    }
  }, [user, loadProjects]);

  return (
    <div className="app-shell">
      <Navbar />

      <Outlet />

      <ModalHost />
    </div>
  );
}

export default App;
