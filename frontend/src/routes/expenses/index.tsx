import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ExpensesPage } from "@/components/ExpensesPage";

export const Route = createFileRoute("/expenses/")({
  component: ExpensesIndexPage,
});

const expensesRoute = getRouteApi("/expenses");

function ExpensesIndexPage() {
  const { month } = expensesRoute.useSearch();
  return <ExpensesPage month={month} />;
}
