import { useEffect, useState, type FormEvent } from 'react'

import { apiErrorMessage } from './apiErrorMessage'
import TimerPage from './TimerPage'
import {
  Configuration,
  ProjectsApi,
  TasksApi,
  TimerApi,
  type Project,
  type Task,
} from './generated/api'
import './App.css'

type EditorState = { kind: 'create' } | { kind: 'edit'; project: Project } | null
type ProjectInput = { name: string; description: string }
type TaskInput = { title: string; description: string; project?: number }
type TaskEditInput = { title: string; description: string; projectId: string }
type View = 'tasks' | 'timer'

const projectsApi = new ProjectsApi(new Configuration({ basePath: '' }))
const tasksApi = new TasksApi(new Configuration({ basePath: '' }))
const timerApi = new TimerApi(new Configuration({ basePath: '' }))

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
  const [view, setView] = useState<View>('tasks')
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
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null)
  const [isDeletingTask, setIsDeletingTask] = useState(false)
  const [taskDeleteError, setTaskDeleteError] = useState('')
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [projectDeleteError, setProjectDeleteError] = useState('')
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

  function updateTaskList(previousTask: Task, updatedTask: Task) {
    setLoadedTaskList((current) => {
      if (!current) return current

      const currentTasks = current.tasks
      const taskWasVisible = currentTasks.some((task) => task.id === previousTask.id)
      const taskBelongsInList = updatedTask.project === current.projectId
      if (!taskWasVisible && !taskBelongsInList) return current

      const visibleTasks =
        taskBelongsInList
          ? [
              ...currentTasks.filter((task) => task.id !== updatedTask.id),
              updatedTask,
            ]
          : currentTasks.filter((task) => task.id !== updatedTask.id)

      return { projectId: current.projectId, tasks: orderTasks(visibleTasks) }
    })
    setTaskLoadError((current) =>
      current &&
      (current.projectId === previousTask.project ||
        current.projectId === updatedTask.project)
        ? null
        : current,
    )
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
      updateTaskList(task, updatedTask)
    } catch (error) {
      setTaskActionError(await apiErrorMessage(error))
    }
  }

  async function startTaskTimer(task: Task) {
    setTaskActionError('')

    try {
      await timerApi.timerStart({ timerStartRequest: { task: task.id } })
      setView('timer')
    } catch (error) {
      setTaskActionError(await apiErrorMessage(error))
    }
  }

  function openTaskDeleteDialog(task: Task) {
    setTaskDeleteError('')
    setTaskPendingDelete(task)
  }

  function closeTaskDeleteDialog() {
    if (!isDeletingTask) setTaskPendingDelete(null)
  }

  async function confirmTaskDelete() {
    if (!taskPendingDelete) return

    setIsDeletingTask(true)
    setTaskDeleteError('')

    try {
      const deletedTask = taskPendingDelete
      await tasksApi.tasksDestroy({ id: deletedTask.id })
      setLoadedTaskList((current) =>
        current
          ? {
              projectId: current.projectId,
              tasks: current.tasks.filter((task) => task.id !== deletedTask.id),
            }
          : current,
      )
      setTaskPendingDelete(null)
    } catch (error) {
      setTaskDeleteError(await apiErrorMessage(error))
    } finally {
      setIsDeletingTask(false)
    }
  }

  function openProjectDeleteDialog(project: Project) {
    setProjectDeleteError('')
    setProjectPendingDelete(project)
  }

  function closeProjectDeleteDialog() {
    if (!isDeletingProject) setProjectPendingDelete(null)
  }

  async function confirmProjectDelete() {
    if (!projectPendingDelete) return

    setIsDeletingProject(true)
    setProjectDeleteError('')

    try {
      const deletedProject = projectPendingDelete
      await projectsApi.projectsDestroy({ id: deletedProject.id })
      const remainingProjects = projects.filter(
        (project) => project.id !== deletedProject.id,
      )
      setProjects(remainingProjects)
      setSelectedProjectId(
        remainingProjects.find((project) => project.isInbox)?.id ??
          remainingProjects[0]?.id ??
          null,
      )
      setProjectPendingDelete(null)
    } catch (error) {
      setProjectDeleteError(await apiErrorMessage(error))
    } finally {
      setIsDeletingProject(false)
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
      updateTaskList(editingTask, updatedTask)
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
        <nav className="topbar-tabs" aria-label="Nawigacja widoków">
          <button
            type="button"
            className={`topbar-tab${view === 'tasks' ? ' is-selected' : ''}`}
            aria-current={view === 'tasks' ? 'page' : undefined}
            onClick={() => setView('tasks')}
          >
            Zadania
          </button>
          <button
            type="button"
            className={`topbar-tab${view === 'timer' ? ' is-selected' : ''}`}
            aria-current={view === 'timer' ? 'page' : undefined}
            onClick={() => setView('timer')}
          >
            Czas
          </button>
        </nav>
        <div className="topbar-caption">
          <span className="topbar-dot" aria-hidden="true" />
          OSOBISTA PRZESTRZEŃ ROBOCZA
        </div>
        <span className="topbar-index">
          {view === 'tasks' ? '01 / PROJEKTY' : '02 / CZAS'}
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
            ) : projects.map((project) => (
              <button
                className={`project-link${project.id === selectedProjectId ? ' is-selected' : ''}`}
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id)
                  setView('tasks')
                }}
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
          {view === 'timer' ? (
            <TimerPage />
          ) : isLoading ? (
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
                <div className="project-heading-actions">
                  {!selectedProject.isInbox && (
                    <button
                      className="quiet-button"
                      onClick={() => openProjectDeleteDialog(selectedProject)}
                    >
                      Usuń projekt
                    </button>
                  )}
                  <button className="quiet-button" onClick={() => openEditForm(selectedProject)}>
                    Edytuj projekt
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
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
                          <button
                            className="task-timer-button"
                            type="button"
                            aria-label={`Uruchom timer: ${task.title}`}
                            title="Uruchom timer"
                            onClick={() => void startTaskTimer(task)}
                          >
                            <span aria-hidden="true">▶</span>
                          </button>
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
                          <button
                            className="task-delete-button"
                            type="button"
                            aria-label={`Usuń zadanie: ${task.title}`}
                            onClick={() => openTaskDeleteDialog(task)}
                          >
                            Usuń
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

      {taskPendingDelete && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeTaskDeleteDialog()
        }}>
          <section className="project-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="task-delete-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
                <h2 id="task-delete-title">Usunąć zadanie?</h2>
              </div>
              <button className="icon-button close-button" onClick={closeTaskDeleteDialog} aria-label="Zamknij">
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="confirm-message">
              Zadanie „{taskPendingDelete.title}" zostanie trwale usunięte. Tej operacji nie można cofnąć.
            </p>
            {taskDeleteError && <p className="form-error" role="alert">{taskDeleteError}</p>}
            <div className="dialog-actions">
              <button className="quiet-button" type="button" onClick={closeTaskDeleteDialog} disabled={isDeletingTask}>
                Anuluj
              </button>
              <button className="danger-button" type="button" onClick={() => void confirmTaskDelete()} disabled={isDeletingTask}>
                {isDeletingTask ? 'Usuwanie…' : 'Usuń zadanie'}
              </button>
            </div>
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
