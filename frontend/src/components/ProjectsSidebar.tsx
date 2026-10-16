import { Link } from "@tanstack/react-router";

import { useLayoutContext } from "../layoutContext";

type ProjectsSidebarProps = {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function ProjectsSidebar({
  isCollapsed = false,
  onToggleCollapse,
}: ProjectsSidebarProps) {
  const { projects, selectedProjectId, isLoading, onNewProject } =
    useLayoutContext();

  return (
    <aside className="sidebar" aria-label="Nawigacja projektów">
      <div className="sidebar-heading">
        {isCollapsed ? (
          <button
            className="icon-button sidebar-expand"
            onClick={onToggleCollapse}
            aria-label="Rozwiń panel projektów"
            title="Rozwiń panel projektów"
          >
            <span aria-hidden="true">»</span>
          </button>
        ) : (
          <>
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
              onClick={onNewProject}
              aria-label="Nowy projekt"
              title="Nowy projekt"
            >
              <span aria-hidden="true">+</span>
            </button>
          </>
        )}
      </div>

      {!isCollapsed && (
        <>
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
                  aria-current={
                    item.id === selectedProjectId ? "page" : undefined
                  }
                  aria-label={item.name}
                >
                  <span
                    className={`project-symbol${item.isInbox ? " is-inbox" : ""}`}
                    aria-hidden="true"
                  >
                    {item.isInbox ? "↳" : "·"}
                  </span>
                  <span className="project-link-name">{item.name}</span>
                </Link>
              ))
            )}
          </nav>
        </>
      )}
    </aside>
  );
}
