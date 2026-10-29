import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/bibliography")({
  component: BibliographyLayout,
});

/** The Bibliography pages read the items themselves (`useBibliographyItems`), sharing one cached copy. */
function BibliographyLayout() {
  return <Outlet />;
}
