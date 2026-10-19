import { createFileRoute } from "@tanstack/react-router";

import { NavTiles } from "@/components/NavTiles";

export const Route = createFileRoute("/")({
  component: MainPage,
});

export function MainPage() {
  return (
    <div className="p-8">
      <NavTiles />
    </div>
  );
}