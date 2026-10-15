import { useEffect, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearch } from '@tanstack/react-router'

import { apiErrorMessage } from './apiErrorMessage'
import { LayoutContextValue } from './layoutContext'
import NotFoundPage from './NotFoundPage'
import {
  Configuration,
  ProjectsApi,
  type Project,
} from './generated/api'
import './App.css'

type ProjectEditorState =
  | { kind: 'create' }
  | { kind: 'edit'; project: Project }
  | null

type ProjectInput = { name: string; description: string }

const projectsApi = new ProjectsApi(new Configuration({ basePath: '' }))

function orderProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

function App() {
  const { project } = useSearch({ from: '__root__' })
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [editor, setEditor] = useState<ProjectEditorState>(null)
  const [form, setForm] = useState<ProjectInput>({ name: '', description: '' })
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [projectDeleteError, setProjectDeleteError] = useState('')

  useEffect(() => {
    let isCurrent = true

    projectsApi.projectsList()
      .then((loadedProjects) => {
        if (!isCurrent) return
        setProjects(orderProjects(loadedProjects))
      })
      .catch(() => {
        if (isCurrent) {
          setPageError('Nie udało się wczytać projektów. Odśwież stronę, aby spróbować ponownie.')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const inbox = projects.find((item) => item.isInbox)
  const selectedProjectId = project ?? inbox?.id ?? projects[0]?.id ?? null
  const projectNotFound =
    !isLoading && project !== undefined && !projects.some((item) => item.id === project)
  const editingProject = editor?.kind === 'edit' ? editor.project : null

  function openCreateForm() {
    setForm({ name: '', description: '' })
    setFormError('')
    setEditor({ kind: 'create' })
  }

  function openEditForm(project: Project) {
    setForm({ name: project.name, description: project.description ?? '' })
    setFormError('')
    setEditor({ kind: 'edit', project })
  }

  function closeForm() {
    if (!isSaving) setEditor(null)
  }

  function openProjectDeleteDialog(project: Project) {
    setProjectDeleteError('')
    setProjectPendingDelete(project)
  }

  function closeProjectDeleteDialog() {
    if (!isDeletingProject) setProjectPendingDelete(null)
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { name: form.name.trim(), description: form.description.trim() }

    if (!input.name) {
      setFormError('Podaj nazwę projektu.')
      return
    }

    setIsSaving(true)
    setFormError('')

    try {
      if (editor?.kind === 'edit') {
        const updatedProject = await projectsApi.projectsPartialUpdate({
          id: editor.project.id,
          patchedProjectRequest: input,
        })
        setProjects((current) =>
          orderProjects(
            current.map((item) => (item.id === updatedProject.id ? updatedProject : item)),
          ),
        )
        navigate({ to: '/tasks', search: { project: updatedProject.id } })
      } else {
        const createdProject = await projectsApi.projectsCreate({ projectRequest: input })
        setProjects((current) => orderProjects([...current, createdProject]))
        navigate({ to: '/tasks', search: { project: createdProject.id } })
      }
      setEditor(null)
    } catch (error) {
      setFormError(await apiErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmProjectDelete() {
    if (!projectPendingDelete) return

    setIsDeletingProject(true)
    setProjectDeleteError('')

    try {
      const deletedProject = projectPendingDelete
      await projectsApi.projectsDestroy({ id: deletedProject.id })
      setProjects((current) => current.filter((item) => item.id !== deletedProject.id))
      setProjectPendingDelete(null)
      const inboxProject = projects.find((item) => item.isInbox)
      if (inboxProject) {
        navigate({ to: '/tasks', search: { project: inboxProject.id } })
      } else {
        navigate({ to: '/tasks' })
      }
    } catch (error) {
      setProjectDeleteError(await apiErrorMessage(error))
    } finally {
      setIsDeletingProject(false)
    }
  }

  const indexLabel =
    pathname === '/timer'
      ? '02 / CZAS'
      : pathname === '/tasks'
        ? '01 / PROJEKTY'
        : '00 / START'

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="DjangoPersonal — strona główna">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DjangoPersonal</span>
        </Link>
        <nav className="topbar-tabs" aria-label="Nawigacja widoków">
          <Link
            className="topbar-tab"
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'topbar-tab is-selected', 'aria-current': 'page' }}
          >
            Start
          </Link>
          <Link
            className="topbar-tab"
            to="/tasks"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'topbar-tab is-selected', 'aria-current': 'page' }}
          >
            Zadania
          </Link>
          <Link
            className="topbar-tab"
            to="/timer"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'topbar-tab is-selected', 'aria-current': 'page' }}
          >
            Czas
          </Link>
        </nav>
        <div className="topbar-caption">
          <span className="topbar-dot" aria-hidden="true" />
          OSOBISTA PRZESTRZEŃ ROBOCZA
        </div>
        <span className="topbar-index">
          {indexLabel}
        </span>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Nawigacja projektów">
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">TWOJE MIEJSCA</p>
              <h2>Projekty</h2>
            </div>
            <button className="icon-button add-project" onClick={openCreateForm} aria-label="Nowy projekt" title="Nowy projekt">
              <span aria-hidden="true">+</span>
            </button>
          </div>

          <nav className="project-navigation" aria-label="Projekty">
            {isLoading ? (
              <p className="sidebar-message">Wczytywanie…</p>
            ) : projects.map((item) => (
              <Link
                className={`project-link${item.id === selectedProjectId ? ' is-selected' : ''}`}
                key={item.id}
                to="/tasks"
                search={{ project: item.id }}
                aria-current={item.id === selectedProjectId ? 'page' : undefined}
                aria-label={item.name}
              >
                <span className={`project-symbol${item.isInbox ? ' is-inbox' : ''}`} aria-hidden="true">
                  {item.isInbox ? '↳' : '·'}
                </span>
                <span className="project-link-name">{item.name}</span>
                {item.isInbox && <span className="project-tag">DOMYŚLNY</span>}
              </Link>
            ))}
          </nav>

          {pageError && <p className="sidebar-error" role="alert">{pageError}</p>}

          <div className="sidebar-footer">
            <span className="footer-rule" />
            <p>Porządek zaczyna się od miejsca.</p>
          </div>
        </aside>

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
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm()
        }}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">{editingProject ? 'ZMIANA SZCZEGÓŁÓW' : 'NOWE MIEJSCE'}</p>
                <h2 id="dialog-title">{editingProject ? 'Edytuj projekt' : 'Nowy projekt'}</h2>
              </div>
              <button className="icon-button close-button" onClick={closeForm} aria-label="Zamknij">
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
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  readOnly={Boolean(editingProject?.isInbox)}
                  required
                />
                {editingProject?.isInbox && <small>Nazwa Inbox jest stała.</small>}
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="dialog-actions">
                <button className="quiet-button" type="button" onClick={closeForm} disabled={isSaving}>
                  Anuluj
                </button>
                <button className="primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? 'Zapisywanie…' : editingProject ? 'Zapisz zmiany' : 'Utwórz projekt'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {projectPendingDelete && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeProjectDeleteDialog()
        }}>
          <section className="project-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="project-delete-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
                <h2 id="project-delete-title">Usunąć projekt?</h2>
              </div>
              <button className="icon-button close-button" onClick={closeProjectDeleteDialog} aria-label="Zamknij">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="confirm-message">
              Projekt „{projectPendingDelete.name}" zostanie trwale usunięty, a jego zadania trafią do Inbox.
            </p>
            {projectDeleteError && <p className="form-error" role="alert">{projectDeleteError}</p>}
            <div className="dialog-actions">
              <button className="quiet-button" type="button" onClick={closeProjectDeleteDialog} disabled={isDeletingProject}>
                Anuluj
              </button>
              <button className="danger-button" type="button" onClick={() => void confirmProjectDelete()} disabled={isDeletingProject}>
                {isDeletingProject ? 'Usuwanie…' : 'Usuń projekt'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
