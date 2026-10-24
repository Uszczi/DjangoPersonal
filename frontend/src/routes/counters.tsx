import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { useCountersStore } from "@/stores/counters";

export const Route = createFileRoute("/counters")({
  component: CountersLayout,
});

/** Loads the counters once for both the list and a counter's page. */
function CountersLayout() {
  const loadCounters = useCountersStore((state) => state.loadCounters);

  useEffect(() => {
    void loadCounters();
  }, [loadCounters]);

  return <Outlet />;
}
