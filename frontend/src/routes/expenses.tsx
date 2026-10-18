import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/expenses")({
  component: ExpensesLayout,
});

function ExpensesLayout() {
  return <Outlet />;
}
