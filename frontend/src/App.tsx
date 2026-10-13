import { useEffect, useState, type FormEvent } from 'react'

import {
  Configuration,
  ProjectsApi,
  ResponseError,
  TasksApi,
  type Project,
  type Task,
} from './generated/api'
import './App.css'

type EditorState = { kind: 'create' } | { kind: 'edit'; project: Project } | null
type ProjectInput = { name: string; description: string }
type TaskInput = { title: string; description: string; project?: number }
type TaskEditInput = { title: string; description: string; projectId: string }

const projectsApi = new ProjectsApi(new Configuration({ basePath: '' }))
const tasksApi = new TasksApi(new Configuration({ basePath: '' }))

async function apiErrorMessage(error: unknown) {
  if (error instanceof ResponseError && error.response) {
    const payload: unknown = await error.response.clone().json().catch(() => undefined)
    if (typeof payload === 'object' && payload !== null) {
      const firstMessage = Object.values(payload)
        .flat()
        .find((value) => typeof value === 'string')
      if (typeof firstMessage === 'string') return firstMessage
    }
    return 'Nie udało się zapisać. Sprawdź dane i spróbuj ponownie.'
  }

  return error instanceof Error
    ? error.message
    : 'Nie udało się zapisać. Spróbuj ponownie.'
}

function orderProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.isInbox !== right.isInbox) return left.isInbox ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

function orderTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) return left.isCompleted ? 1 : -1
    return left.id - right.id
  })
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [loadedTaskList, setLoadedTaskList] = useState<{
    projectId: number
    tasks: Task[]
  } | null>(null)
  const [taskLoadError, setTaskLoadError] = useState<{
    projectId: number
    message: string
  } | null>(null)
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '' })
  const [taskFormError, setTaskFormError] = useState('')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskEditForm, setTaskEditForm] = useState<TaskEditInput>({
    title: '',
    description: '',
    projectId: '',
  })
  const [taskEditError, setTaskEditError] = useState('')
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState(false)
  const [taskActionError, setTaskActionError] = useState('')
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

  useEffect(() => {
    if (selectedProjectId === null) return

    let isCurrent = true

    tasksApi.tasksList({ project: selectedProjectId })
      .then((loadedTasks) => {
        if (!isCurrent) return
        setLoadedTaskList({
          projectId: selectedProjectId,
          tasks: orderTasks(loadedTasks),
        })
        setTaskLoadError(null)
      })
      .catch(() => {
        if (isCurrent) {
          setTaskLoadError({
            projectId: selectedProjectId,
            message: 'Nie udało się wczytać zadań. Spróbuj ponownie.',
          })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [selectedProjectId])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const tasks = loadedTaskList?.projectId === selectedProjectId ? loadedTaskList.tasks : []
  const tasksError = taskLoadError?.projectId === selectedProjectId ? taskLoadError.message : ''
  const isTasksLoading =
    selectedProjectId !== null &&
    loadedTaskList?.projectId !== selectedProjectId &&
    taskLoadError?.projectId !== selectedProjectId
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

  function openTaskForm() {
    setTaskForm({ title: '', description: '' })
    setTaskFormError('')
    setIsTaskEditorOpen(true)
  }

  function closeTaskForm() {
    if (!isCreatingTask) setIsTaskEditorOpen(false)
  }

  function openTaskEditForm(task: Task) {
    setTaskEditForm({
      title: task.title,
      description: task.description ?? '',
      projectId: String(task.project),
    })
    setTaskEditError('')
    setEditingTask(task)
  }

  function closeTaskEditForm() {
    if (!isSavingTaskEdit) setEditingTask(null)
  }

  function updateTaskInCurrentProject(updatedTask: Task) {
    if (selectedProjectId === null) return

    setLoadedTaskList((current) => {
      const currentTasks =
        current?.projectId === selectedProjectId ? current.tasks : []
      const visibleTasks =
        updatedTask.project === selectedProjectId
          ? currentTasks.map((task) => task.id === updatedTask.id ? updatedTask : task)
          : currentTasks.filter((task) => task.id !== updatedTask.id)

      return { projectId: selectedProjectId, tasks: orderTasks(visibleTasks) }
    })
    setTaskLoadError(null)
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
            current.map((project) =>
              project.id === updatedProject.id ? updatedProject : project,
            ),
          ),
        )
        setSelectedProjectId(updatedProject.id)
      } else {
        const createdProject = await projectsApi.projectsCreate({ projectRequest: input })
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

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskForm.title.trim()

    if (!title) {
      setTaskFormError('Podaj tytuł zadania.')
      return
    }

    const input: TaskInput = {
      title,
      description: taskForm.description.trim(),
      ...(selectedProjectId === null ? {} : { project: selectedProjectId }),
    }

    setIsCreatingTask(true)
    setTaskFormError('')

    try {
      const createdTask = await tasksApi.tasksCreate({ taskCreateRequest: input })
      if (selectedProjectId !== null) {
        setLoadedTaskList((current) => ({
          projectId: selectedProjectId,
          tasks: orderTasks([
            ...(current?.projectId === selectedProjectId ? current.tasks : []),
            createdTask,
          ]),
        }))
      }
      setTaskLoadError(null)
      setIsTaskEditorOpen(false)
    } catch (error) {
      setTaskFormError(await apiErrorMessage(error))
    } finally {
      setIsCreatingTask(false)
    }
  }

  async function toggleTaskCompletion(task: Task) {
    setTaskActionError('')

    try {
      const updatedTask = await tasksApi.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { isCompleted: !task.isCompleted },
      })
      updateTaskInCurrentProject(updatedTask)
    } catch (error) {
      setTaskActionError(await apiErrorMessage(error))
    }
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskEditForm.title.trim()
    const projectId = Number(taskEditForm.projectId)

    if (!title) {
      setTaskEditError('Podaj tytuł zadania.')
      return
    }
    if (!Number.isInteger(projectId)) {
      setTaskEditError('Wybierz projekt dla zadania.')
      return
    }

    if (!editingTask) return

    setIsSavingTaskEdit(true)
    setTaskEditError('')

    try {
      const updatedTask = await tasksApi.tasksPartialUpdate({
        id: editingTask.id,
        patchedTaskUpdateRequest: {
          title,
          description: taskEditForm.description.trim(),
          project: projectId,
        },
      })
      updateTaskInCurrentProject(updatedTask)
      setEditingTask(null)
    } catch (error) {
      setTaskEditError(await apiErrorMessage(error))
    } finally {
      setIsSavingTaskEdit(false)
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

              <section className="tasks-section" aria-labelledby="tasks-heading">
                <div className="task-section-heading">
                  <div>
                    <p className="eyebrow">W TYM PROJEKCIE</p>
                    <h2 id="tasks-heading">Zadania</h2>
                  </div>
                  <div className="task-heading-actions">
                    <span className="task-count">{tasks.length} {tasks.length === 1 ? 'ZADANIE' : 'ZADAŃ'}</span>
                    <button className="primary-button new-task-button" onClick={openTaskForm}>
                      <span aria-hidden="true">+</span>
                      Nowe zadanie
                    </button>
                  </div>
                </div>

                {isTasksLoading ? (
                  <p className="task-message" role="status">Wczytywanie zadań…</p>
                ) : tasksError ? (
                  <p className="task-error" role="alert">{tasksError}</p>
                ) : tasks.length === 0 ? (
                  <p className="task-empty-state">Nie ma tu jeszcze zadań.</p>
                ) : (
                  <ul className="task-list" aria-label="Zadania">
                    {tasks.map((task) => (
                      <li className={`task-row${task.isCompleted ? ' is-completed' : ''}`} key={task.id}>
                        <button
                          className={`task-status-toggle${task.isCompleted ? ' is-completed' : ''}`}
                          type="button"
                          aria-label={`${task.isCompleted ? 'Otwórz zadanie' : 'Oznacz jako ukończone'}: ${task.title}`}
                          onClick={() => void toggleTaskCompletion(task)}
                        >
                          {task.isCompleted ? '✓' : ''}
                        </button>
                        <div className="task-copy">
                          <p>{task.title}</p>
                          {task.description && <small>{task.description}</small>}
                        </div>
                        <div className="task-row-actions">
                          <span className="task-status-label">
                            {task.isCompleted ? 'UKOŃCZONE' : 'OTWARTE'}
                          </span>
                          <button
                            className="task-edit-button"
                            type="button"
                            aria-label={`Edytuj zadanie: ${task.title}`}
                            onClick={() => openTaskEditForm(task)}
                          >
                            Edytuj
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {taskActionError && <p className="task-error" role="alert">{taskActionError}</p>}
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

      {isTaskEditorOpen && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTaskForm()
        }}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">NOWE ZADANIE</p>
                <h2 id="task-dialog-title">Dodaj do {selectedProject?.name ?? 'Inbox'}</h2>
              </div>
              <button className="icon-button close-button" onClick={closeTaskForm} aria-label="Zamknij">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={saveTask}>
              <label className="form-field">
                <span>Tytuł zadania</span>
                <input
                  autoFocus
                  maxLength={200}
                  value={taskForm.title}
                  onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              {taskFormError && <p className="form-error" role="alert">{taskFormError}</p>}
              <div className="dialog-actions">
                <button className="quiet-button" type="button" onClick={closeTaskForm} disabled={isCreatingTask}>
                  Anuluj
                </button>
                <button className="primary-button" type="submit" disabled={isCreatingTask}>
                  {isCreatingTask ? 'Zapisywanie…' : 'Utwórz zadanie'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingTask && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTaskEditForm()
        }}>
          <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="task-edit-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ZMIANA SZCZEGÓŁÓW</p>
                <h2 id="task-edit-title">Edytuj zadanie</h2>
              </div>
              <button className="icon-button close-button" onClick={closeTaskEditForm} aria-label="Zamknij">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={saveTaskEdit}>
              <label className="form-field">
                <span>Tytuł zadania</span>
                <input
                  autoFocus
                  maxLength={200}
                  value={taskEditForm.title}
                  onChange={(event) => setTaskEditForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={taskEditForm.description}
                  onChange={(event) => setTaskEditForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>Projekt zadania</span>
                <select
                  value={taskEditForm.projectId}
                  onChange={(event) => setTaskEditForm((current) => ({ ...current, projectId: event.target.value }))}
                  required
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              {taskEditError && <p className="form-error" role="alert">{taskEditError}</p>}
              <div className="dialog-actions">
                <button className="quiet-button" type="button" onClick={closeTaskEditForm} disabled={isSavingTaskEdit}>
                  Anuluj
                </button>
                <button className="primary-button" type="submit" disabled={isSavingTaskEdit}>
                  {isSavingTaskEdit ? 'Zapisywanie…' : 'Zapisz zmiany'}
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
