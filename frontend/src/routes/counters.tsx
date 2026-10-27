import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/counters")({
  component: CountersLayout,
});

/** The Counter pages read the list themselves (`useCounters`), sharing one cached copy. */
function CountersLayout() {
  return <Outlet />;
}
