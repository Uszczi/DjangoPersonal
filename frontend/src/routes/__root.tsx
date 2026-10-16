import { createRootRoute, retainSearchParams } from "@tanstack/react-router";

import { useEffect, useState, type FormEvent } from "react";
import { Link, Outlet, useNavigate, useSearch } from "@tanstack/react-router";

import { apiErrorMessage } from "../apiErrorMessage";
import { LayoutContextValue } from "../layoutContext";
import { Configuration, ProjectsApi, type Project } from "../generated/api";
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

type ProjectEditorState =
  { kind: "create" } | { kind: "edit"; project: Project } | null;

type ProjectInput = { name: string; description: string };

const projectsApi = new ProjectsApi(new Configuration({ basePath: "" }));

function orderProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
}

/** The Project a task falls back to: Inbox when present, otherwise the first Project. */
function defaultProject(projects: Project[]) {
  return projects.find((item) => item.isInbox) ?? projects[0] ?? null;
}

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [editor, setEditor] = useState<ProjectEditorState>(null);
  const [form, setForm] = useState<ProjectInput>({ name: "", description: "" });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] =
    useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    projectsApi
      .projectsList()
      .then((loadedProjects) => {
        if (!isCurrent) return;
        setProjects(orderProjects(loadedProjects));
      })
      .catch(() => {
        if (isCurrent) {
          setPageError(
            "Nie udało się wczytać projektów. Odśwież stronę, aby spróbować ponownie.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const projectNotFound =
    !isLoading &&
    !pageError &&
    project !== undefined &&
    !projects.some((item) => item.id === project);
  const editingProject = editor?.kind === "edit" ? editor.project : null;

  function openCreateForm() {
    setForm({ name: "", description: "" });
    setFormError("");
    setEditor({ kind: "create" });
  }

  function openEditForm(project: Project) {
    setForm({ name: project.name, description: project.description ?? "" });
    setFormError("");
    setEditor({ kind: "edit", project });
  }

  function closeForm() {
    if (!isSaving) setEditor(null);
  }

  function openProjectDeleteDialog(project: Project) {
    setProjectDeleteError("");
    setProjectPendingDelete(project);
  }

  function closeProjectDeleteDialog() {
    if (!isDeletingProject) setProjectPendingDelete(null);
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
      if (editor?.kind === "edit") {
        const updatedProject = await projectsApi.projectsPartialUpdate({
          id: editor.project.id,
          patchedProjectRequest: input,
        });
        setProjects((current) =>
          orderProjects(
            current.map((item) =>
              item.id === updatedProject.id ? updatedProject : item,
            ),
          ),
        );
        navigate({ to: "/tasks", search: { project: updatedProject.id } });
      } else {
        const createdProject = await projectsApi.projectsCreate({
          projectRequest: input,
        });
        setProjects((current) => orderProjects([...current, createdProject]));
        navigate({ to: "/tasks", search: { project: createdProject.id } });
      }
      setEditor(null);
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmProjectDelete() {
    if (!projectPendingDelete) return;

    setIsDeletingProject(true);
    setProjectDeleteError("");

    try {
      const deletedProject = projectPendingDelete;
      await projectsApi.projectsDestroy({ id: deletedProject.id });
      setProjects((current) =>
        current.filter((item) => item.id !== deletedProject.id),
      );
      setProjectPendingDelete(null);
      const fallbackProject = defaultProject(projects);
      if (fallbackProject) {
        navigate({ to: "/tasks", search: { project: fallbackProject.id } });
      } else {
        navigate({ to: "/tasks" });
      }
    } catch (error) {
      setProjectDeleteError(await apiErrorMessage(error));
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
            <LayoutContextValue.Provider
              value={{
                projects,
                selectedProjectId,
                isLoading,
                onNewProject: openCreateForm,
                onEditProject: openEditForm,
                onDeleteProject: openProjectDeleteDialog,
              }}
            >
              <Outlet />
            </LayoutContextValue.Provider>
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

      {projectPendingDelete && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
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
                onClick={closeProjectDeleteDialog}
                aria-label="Zamknij"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="confirm-message">
              Projekt „{projectPendingDelete.name}" zostanie trwale usunięty, a
              jego zadania trafią do Inbox.
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
                onClick={closeProjectDeleteDialog}
                disabled={isDeletingProject}
              >
                Anuluj
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => void confirmProjectDelete()}
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
