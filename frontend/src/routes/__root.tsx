import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect, useState, type FormEvent } from "react";
import { Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";

import { apiErrorMessage } from "../apiErrorMessage";
import { NotFoundPage } from "../components/NotFoundPage";
import { useProjectsStore } from "../stores/projects";
import "../App.css";

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { project?: number } => ({
    project: typeof search.project === "number" ? search.project : undefined,
  }),
  search: {
    middlewares: [retainSearchParams(["project"])],
  },
  component: App,
});

type ProjectInput = { name: string; description: string };

type TopTabPath = "/" | "/tasks" | "/timer";

function TopTabLink({ to, children }: { to: TopTabPath; children: string }) {
  return (
    <Link
      className="topbar-tab"
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{
        className: "topbar-tab is-selected",
        "aria-current": "page",
      }}
    >
      {children}
    </Link>
  );
}

function App() {
  const { project } = useSearch({ from: "__root__" });
  const navigate = useNavigate();

  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const editor = useProjectsStore((state) => state.editor);
  const pendingDelete = useProjectsStore((state) => state.pendingDelete);
  const projectDeleteError = useProjectsStore(
    (state) => state.projectDeleteError,
  );
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const closeEditor = useProjectsStore((state) => state.closeEditor);
  const saveProjectAction = useProjectsStore((state) => state.saveProject);
  const closeProjectDeleteDialog = useProjectsStore(
    (state) => state.closeProjectDeleteDialog,
  );
  const confirmProjectDelete = useProjectsStore(
    (state) => state.confirmProjectDelete,
  );

  const [form, setForm] = useState<ProjectInput>({ name: "", description: "" });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const projectNotFound =
    !isLoading &&
    !pageError &&
    project !== undefined &&
    !projects.some((item) => item.id === project);
  const editingProject = editor?.kind === "edit" ? editor.project : null;

  function resetForm() {
    setForm({ name: "", description: "" });
    setFormError("");
  }

  function closeForm() {
    if (!isSaving) {
      resetForm();
      closeEditor();
    }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      name: form.name.trim(),
      description: form.description.trim(),
    };

    if (!input.name) {
      setFormError("Podaj nazwę projektu.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const savedProject = await saveProjectAction(input);
      resetForm();
      navigate({ to: "/tasks", search: { project: savedProject.id } });
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProjectDelete() {
    setIsDeletingProject(true);

    try {
      const fallbackProject = await confirmProjectDelete();
      if (fallbackProject) {
        navigate({ to: "/tasks", search: { project: fallbackProject.id } });
      } else {
        navigate({ to: "/tasks" });
      }
    } catch {
      // The error is surfaced through the store-backed dialog.
    } finally {
      setIsDeletingProject(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link
          className="brand"
          to="/"
          aria-label="DjangoPersonal — strona główna"
        >
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>DjangoPersonal</span>
        </Link>
        <nav className="topbar-tabs" aria-label="Nawigacja widoków">
          <TopTabLink to="/">Start</TopTabLink>
          <TopTabLink to="/tasks">Zadania</TopTabLink>
          <TopTabLink to="/timer">Czas</TopTabLink>
        </nav>
      </header>

      <div className="workspace">
        <main className="main-panel">
          {projectNotFound ? (
            <NotFoundPage />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {editor && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">
                  {editingProject ? "ZMIANA SZCZEGÓŁÓW" : "NOWE MIEJSCE"}
                </p>
                <h2 id="dialog-title">
                  {editingProject ? "Edytuj projekt" : "Nowy projekt"}
                </h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={closeForm}
                aria-label="Zamknij"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={saveProject}>
              <label className="form-field">
                <span>Nazwa projektu</span>
                <input
                  autoFocus
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  readOnly={Boolean(editingProject?.isInbox)}
                  required
                />
                {editingProject?.isInbox && (
                  <small>Nazwa Inbox jest stała.</small>
                )}
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Anuluj
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Zapisywanie…"
                    : editingProject
                      ? "Zapisz zmiany"
                      : "Utwórz projekt"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingDelete && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeletingProject)
              closeProjectDeleteDialog();
          }}
        >
          <section
            className="project-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
                <h2 id="project-delete-title">Usunąć projekt?</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={() => {
                  if (!isDeletingProject) closeProjectDeleteDialog();
                }}
                aria-label="Zamknij"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="confirm-message">
              Projekt „{pendingDelete.name}" zostanie trwale usunięty, a jego
              zadania trafią do Inbox.
            </p>
            {projectDeleteError && (
              <p className="form-error" role="alert">
                {projectDeleteError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="quiet-button"
                type="button"
                onClick={() => {
                  if (!isDeletingProject) closeProjectDeleteDialog();
                }}
                disabled={isDeletingProject}
              >
                Anuluj
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => void handleProjectDelete()}
                disabled={isDeletingProject}
              >
                {isDeletingProject ? "Usuwanie…" : "Usuń projekt"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
