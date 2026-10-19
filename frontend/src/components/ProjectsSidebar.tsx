import { Link } from "@tanstack/react-router";

import { InboxIcon } from "@/components/InboxIcon";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ShowModal } from "@/stores/modal";
import { useProjectsStore } from "@/stores/projects";

type ProjectsSidebarProps = {
  selectedProjectId: number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function ProjectsSidebar({
  selectedProjectId,
  isCollapsed = false,
  onToggleCollapse,
}: ProjectsSidebarProps) {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);

  if (isCollapsed) {
    return (
      <aside className="flex flex-col max-md:hidden bg-deep-ink p-[12px_11px] text-[#edf3f0]" aria-label="Nawigacja projektów">
        <div className="flex items-end justify-between gap-4">
          <button
            className="inline-flex h-[33px] w-[33px] items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] leading-none text-[#f3f7f3] transition-all hover:-translate-y-px cursor-pointer hover:bg-[#29474d] hover:border-[#6e8b8d]"
            onClick={onToggleCollapse}
            aria-label="Rozwiń panel projektów"
            title="Rozwiń panel projektów"
          >
            <span aria-hidden="true">»</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col bg-deep-ink p-[42px_20px_25px] text-[#edf3f0]" aria-label="Nawigacja projektów">
      <div className="flex items-end justify-between gap-4">
        <button
          className="inline-flex h-[33px] w-[33px] items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] leading-none text-[#f3f7f3] transition-all hover:-translate-y-px cursor-pointer hover:bg-[#29474d] hover:border-[#6e8b8d]"
          onClick={onToggleCollapse}
          aria-label="Zwiń panel projektów"
          title="Zwiń panel projektów"
        >
          <span aria-hidden="true">«</span>
        </button>
        <div>
          <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-white">Projekty</h2>
        </div>
        <button
          className="inline-flex h-[33px] w-[33px] items-center justify-center rounded-md border border-[#456066] bg-transparent text-[23px] leading-none text-[#f3f7f3] transition-all hover:-translate-y-px cursor-pointer hover:bg-[#29474d] hover:border-[#6e8b8d]"
          onClick={() => ShowModal(ProjectEditorModal)}
          aria-label="Nowy projekt"
          title="Nowy projekt"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <nav className="mt-5 flex flex-col gap-1" aria-label="Projekty">
        {isLoading ? (
          <p className="pt-[40px] text-muted">Wczytywanie…</p>
        ) : (
          projects.map((item) => (
            <Link
              className="relative flex min-h-[43px] w-full items-center gap-3 rounded-md bg-transparent px-[10px] text-left font-inherit text-[#c2d0ce] transition-colors hover:bg-[#203f45] hover:text-white aria-[current]:bg-[#28474c] aria-[current]:text-white"
              key={item.id}
              to="/tasks"
              search={{ project: item.id }}
              aria-current={item.id === selectedProjectId ? "page" : undefined}
              aria-label={item.name}
            >
              <span
                className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[11px] font-semibold ${item.isInbox ? "border-signal bg-signal text-white" : "border-[#456066] text-[#8fa5a5]"}`}
                aria-hidden="true"
              >
                {item.isInbox ? <InboxIcon /> : "·"}
              </span>
              <span className="truncate text-[13px] font-medium">{item.name}</span>
            </Link>
          ))
        )}
      </nav>

      <button
        type="button"
        className="mt-auto inline-flex h-[33px] w-[33px] items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] leading-none text-[#f3f7f3] transition-all hover:-translate-y-px cursor-pointer hover:bg-[#29474d] hover:border-[#6e8b8d]"
        onClick={onToggleCollapse}
        aria-label="Zamknij panel projektów"
        title="Zamknij panel"
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}