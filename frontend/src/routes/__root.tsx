import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { ModalHost } from "@/components/modals/ModalHost";
import { Navbar } from "@/components/Navbar";
import { authGuard } from "@/guards/auth";
import { useAuthStore } from "@personal/shared/stores/auth";
import { useProjectsStore } from "@personal/shared/stores/projects";

export const Route = createRootRoute({
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
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-app flex-1 p-8">
        <Outlet />
      </main>

      <ModalHost />
    </div>
  );
}

export default App;
