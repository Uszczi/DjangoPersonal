import { createFileRoute, Outlet } from "@tanstack/react-router";

import { isMonthKey, type MonthKey } from "@personal/shared/expenseMonth";

/** The shown month lives in the address (`?month=2026-10`), so a month can be linked to. */
function validateMonth(search: Record<string, unknown>): { month?: MonthKey } {
  return { month: isMonthKey(search.month) ? search.month : undefined };
}

export const Route = createFileRoute("/expenses")({
  validateSearch: validateMonth,
  component: ExpensesLayout,
});

function ExpensesLayout() {
  return <Outlet />;
}
