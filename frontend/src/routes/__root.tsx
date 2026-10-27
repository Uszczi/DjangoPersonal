import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";

import { ModalHost } from "@/components/modals/ModalHost";
import { Navbar } from "@/components/Navbar";
import { authGuard } from "@/guards/auth";
import { queryClient } from "@/queryClient";

export const Route = createRootRoute({
  beforeLoad: authGuard,
  component: App,
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <Navbar />

        <main className="mx-auto w-full max-w-app flex-1 p-2 sm:p-8">
          <Outlet />
        </main>

        <ModalHost />
      </div>
    </QueryClientProvider>
  );
}

export default App;
