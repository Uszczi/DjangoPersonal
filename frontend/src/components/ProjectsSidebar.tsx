import { Link } from "@tanstack/react-router";

import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { InboxIcon } from "@/design-system";
import { ShowModal } from "@/stores/modal";
import { useProjects } from "@personal/shared/queries/projects";

const toggleButtonClasses =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border bg-transparent text-[20px] leading-none text-[#f3f7f3] transition-colors hover:border-[#6e8b8d] hover:bg-[#29474d]";

type ProjectNavListProps = {
  selectedProjectId: number | null;
  /** `dark` on the deep-ink sidebar, `light` in the mobile drawer. */
  tone: "dark" | "light";
  /** Called after a project is picked, e.g. to close the drawer. */
  onNavigate?: () => void;
};

/** The Projects as links to their Tasks; shared by the sidebar and the mobile drawer. */
export function ProjectNavList({
  selectedProjectId,
  tone,
  onNavigate,
}: ProjectNavListProps) {
  const { data: projects = [], isPending } = useProjects();

  const linkTone =
    tone === "dark"
      ? "text-[#c2d0ce] hover:bg-[#203f45] hover:text-white aria-[current]:bg-[#28474c] aria-[current]:text-white"
      : "text-ink-soft hover:bg-wash hover:text-ink aria-[current]:bg-wash aria-[current]:text-ink";
  const dotTone = tone === "dark" ? "bg-[#6e8b8d]" : "bg-icon";

  return (
    <nav className="flex flex-col gap-1" aria-label="Projekty">
      {isPending ? (
        <p className="px-[10px] py-2 text-[13px] text-muted">Wczytywanie…</p>
      ) : (
        projects.map((item) => (
          <Link
            className={`flex min-h-10 w-full items-center gap-3 rounded-md px-[10px] text-left no-underline transition-colors ${linkTone}`}
            key={item.id}
            to="/tasks"
            search={{ project: item.id }}
            aria-current={item.id === selectedProjectId ? "page" : undefined}
            aria-label={item.name}
            onClick={onNavigate}
          >
            <span
              className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              {item.isInbox ? (
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-signal text-[13px] text-white">
                  <InboxIcon />
                </span>
              ) : (
                <span className={`h-2 w-2 rounded-full ${dotTone}`} />
              )}
            </span>
            <span className="truncate text-[13px] font-medium">
              {item.name}
            </span>
          </Link>
        ))
      )}
    </nav>
  );
}

type ProjectsSidebarProps = {
  selectedProjectId: number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

/**
 * The Projects panel beside the Tasks list, from `md` up; small screens open
 * the same list in a drawer instead (see the Tasks page header).
 */
export function ProjectsSidebar({
  selectedProjectId,
  isCollapsed = false,
  onToggleCollapse,
}: ProjectsSidebarProps) {
  const panelClasses =
    "sticky top-8 h-[calc(100vh-132px)] shrink-0 self-start overflow-y-auto rounded-lg bg-deep-ink text-[#edf3f0] max-md:hidden";

  if (isCollapsed) {
    return (
      <aside className={`${panelClasses} p-2`} aria-label="Nawigacja projektów">
        <button
          className={`${toggleButtonClasses} border-transparent`}
          onClick={onToggleCollapse}
          aria-label="Rozwiń panel projektów"
          title="Rozwiń panel projektów"
        >
          <span aria-hidden="true">»</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`${panelClasses} flex w-[248px] flex-col gap-4 p-4`}
      aria-label="Nawigacja projektów"
    >
      <div className="flex items-center gap-1 pl-[10px]">
        <h2 className="mr-auto font-display text-[17px] font-bold tracking-[-0.02em] text-white">
          Projekty
        </h2>
        <button
          className={`${toggleButtonClasses} border-[#456066]`}
          onClick={() => ShowModal(ProjectEditorModal)}
          aria-label="Nowy projekt"
          title="Nowy projekt"
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          className={`${toggleButtonClasses} border-transparent`}
          onClick={onToggleCollapse}
          aria-label="Zwiń panel projektów"
          title="Zwiń panel projektów"
        >
          <span aria-hidden="true">«</span>
        </button>
      </div>

      <ProjectNavList selectedProjectId={selectedProjectId} tone="dark" />
    </aside>
  );
}
