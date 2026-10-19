import { Link } from "@tanstack/react-router";

const NAV_TILES = [
  { to: "/tasks", label: "Zadania", icon: "☑" },
  { to: "/projects", label: "Projekty", icon: "◆" },
  { to: "/timer", label: "Czas", icon: "◷" },
  { to: "/whiteboard", label: "Notatki", icon: "✎" },
  { to: "/expenses", label: "Wydatki", icon: "€" },
] as const;

export function NavTiles() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {NAV_TILES.map((tile) => (
        <Link
          key={tile.to}
          to={tile.to}
          className="flex items-center gap-4 rounded-lg border border-[#dce4df] bg-paper p-5 shadow-[0_14px_35px_rgb(29_55_57/5%)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgb(29_55_57/8%)]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-signal text-xl text-white">
            {tile.icon}
          </span>
          <span className="font-display text-lg font-semibold text-ink">{tile.label}</span>
        </Link>
      ))}
    </div>
  );
}
