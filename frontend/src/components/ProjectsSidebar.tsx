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
      <aside className="sidebar is-collapsed" aria-label="Nawigacja projektów">
        <div className="sidebar-heading">
          <button
            className="icon-button sidebar-expand"
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
    <aside className="sidebar" aria-label="Nawigacja projektów">
      <div className="sidebar-heading">
        <button
          className="icon-button sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label="Zwiń panel projektów"
          title="Zwiń panel projektów"
        >
          <span aria-hidden="true">«</span>
        </button>
        <div>
          <h2>Projekty</h2>
        </div>
        <button
          className="icon-button add-project"
          onClick={() => ShowModal(ProjectEditorModal)}
          aria-label="Nowy projekt"
          title="Nowy projekt"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <nav className="project-navigation" aria-label="Projekty">
        {isLoading ? (
          <p className="sidebar-message">Wczytywanie…</p>
        ) : (
          projects.map((item) => (
            <Link
              className={`project-link${item.id === selectedProjectId ? " is-selected" : ""}`}
              key={item.id}
              to="/tasks"
              search={{ project: item.id }}
              aria-current={item.id === selectedProjectId ? "page" : undefined}
              aria-label={item.name}
            >
              <span
                className={`project-symbol${item.isInbox ? " is-inbox" : ""}`}
                aria-hidden="true"
              >
                {item.isInbox ? <InboxIcon /> : "·"}
              </span>
              <span className="project-link-name">{item.name}</span>
            </Link>
          ))
        )}
      </nav>

      <button
        type="button"
        className="icon-button sidebar-close"
        onClick={onToggleCollapse}
        aria-label="Zamknij panel projektów"
        title="Zamknij panel"
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
