import { createFileRoute } from "@tanstack/react-router";

import { NavTiles } from "@/components/NavTiles";

export const Route = createFileRoute("/")({
  component: MainPage,
});

export function MainPage() {
  return (
    <>
      <div className="mb-6">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Start</h1>
        </div>
      </div>
      <NavTiles />
    </>
  );
}