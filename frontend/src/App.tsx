import { useEffect, useState, type FormEvent } from 'react'

import {
  Configuration,
  ProjectsApi,
  ResponseError,
  type Project,
} from './generated/api'
import './App.css'

type EditorState = { kind: 'create' } | { kind: 'edit'; project: Project } | null
type ProjectInput = { name: string; description: string }

const projectsApi = new ProjectsApi(new Configuration({ basePath: '' }))

async function apiErrorMessage(error: unknown) {
  if (error instanceof ResponseError) {
    const payload: unknown = await error.response.clone().json().catch(() => undefined)
    if (typeof payload === 'object' && payload !== null) {
      const firstMessage = Object.values(payload)
        .flat()
        .find((value) => typeof value === 'string')
      if (typeof firstMessage === 'string') return firstMessage
    }
    return 'Nie udało się zapisać projektu. Sprawdź dane i spróbuj ponownie.'
  }

  return error instanceof Error
    ? error.message
    : 'Nie udało się zapisać projektu. Spróbuj ponownie.'
}

function orderProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [editor, setEditor] = useState<EditorState>(null)
  const [form, setForm] = useState<ProjectInput>({ name: '', description: '' })
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCurrent = true

    projectsApi.projectsList()
      .then((loadedProjects) => {
        if (!isCurrent) return
        const orderedProjects = orderProjects(loadedProjects)
        setProjects(orderedProjects)
        setSelectedProjectId(
          orderedProjects.find((project) => project.isInbox)?.id ??
            orderedProjects[0]?.id ??
            null,
        )
      })
      .catch(() => {
        if (isCurrent) setPageError('Nie udało się wczytać projektów. Odśwież stronę, aby spróbować ponownie.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
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
          patchedProject: input,
        })
        setProjects((current) =>
          orderProjects(
            current.map((project) =>
              project.id === updatedProject.id ? updatedProject : project,
            ),
          ),
        )
        setSelectedProjectId(updatedProject.id)
      } else {
        const createdProject = await projectsApi.projectsCreate({ project: input })
        setProjects((current) => orderProjects([...current, createdProject]))
        setSelectedProjectId(createdProject.id)
      }
      setEditor(null)
    } catch (error) {
      setFormError(await apiErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DjangoPersonal — strona główna">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DjangoPersonal</span>
        </a>
        <div className="topbar-caption">
          <span className="topbar-dot" aria-hidden="true" />
          OSOBISTA PRZESTRZEŃ ROBOCZA
        </div>
        <span className="topbar-index">01 / PROJEKTY</span>
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
            ) : projects.map((project) => (
              <button
                className={`project-link${project.id === selectedProjectId ? ' is-selected' : ''}`}
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                aria-current={project.id === selectedProjectId ? 'page' : undefined}
                aria-label={project.name}
              >
                <span className={`project-symbol${project.isInbox ? ' is-inbox' : ''}`} aria-hidden="true">
                  {project.isInbox ? '↳' : '·'}
                </span>
                <span className="project-link-name">{project.name}</span>
                {project.isInbox && <span className="project-tag">DOMYŚLNY</span>}
              </button>
            ))}
          </nav>

          {pageError && <p className="sidebar-error" role="alert">{pageError}</p>}

          <div className="sidebar-footer">
            <span className="footer-rule" />
            <p>Porządek zaczyna się od miejsca.</p>
          </div>
        </aside>

        <main className="main-panel">
          {isLoading ? (
            <div className="loading-state" role="status">Wczytywanie projektów…</div>
          ) : selectedProject ? (
            <>
              <div className="breadcrumb">
                <span>PRZESTRZEŃ</span>
                <span className="breadcrumb-slash">/</span>
                <span>{selectedProject.isInbox ? 'START' : 'PROJEKT'}</span>
              </div>

              <div className="project-heading">
                <div>
                  <p className="project-kicker">
                    {selectedProject.isInbox ? 'ZAWSZE POD RĘKĄ' : 'TWOJA PRZESTRZEŃ'}
                  </p>
                  <h1>{selectedProject.name}</h1>
                </div>
                <button className="quiet-button" onClick={() => openEditForm(selectedProject)}>
                  Edytuj projekt
                  <span aria-hidden="true">↗</span>
                </button>
              </div>

              <section className="project-card" aria-label="Szczegóły projektu">
                <div className="card-edge" aria-hidden="true" />
                <div className="card-topline">
                  <span>{selectedProject.isInbox ? 'SKRZYNKA DOMYŚLNA' : 'PROJEKT'}</span>
                  <span className="card-mark" aria-hidden="true">✳</span>
                </div>
                <p className="project-description">
                  {selectedProject.description ||
                    (selectedProject.isInbox
                      ? 'Zadania bez wybranego projektu trafiają właśnie tutaj.'
                      : 'Dodaj opis, aby zapisać kontekst tego projektu.')}
                </p>
                <div className="card-bottomline">
                  <span className="status-light" aria-hidden="true" />
                  <span>GOTOWE NA TWOJE ZADANIA</span>
                </div>
              </section>

              {projects.length === 1 && (
                <p className="first-project-note">
                  Gdy będziesz gotowy, dodaj projekt, aby oddzielić różne obszary pracy.
                </p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">BRAK PROJEKTÓW</p>
              <h1>Utwórz pierwsze miejsce pracy</h1>
              <button className="primary-button" onClick={openCreateForm}>Nowy projekt</button>
            </div>
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
    </div>
  )
}

export default App
