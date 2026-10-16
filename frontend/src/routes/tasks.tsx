import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "../apiErrorMessage";
import { ProjectEditorModal } from "../components/ProjectEditorModal";
import { ProjectsSidebar } from "../components/ProjectsSidebar";
import { useLayoutStore } from "../stores/layout";
import { ShowModal } from "../stores/modal";
import { defaultProject, useProjectsStore } from "../stores/projects";
import {
  useTasksStore,
  type TaskEditInput,
  type TaskInput,
} from "../stores/tasks";
import type { Task } from "../generated/api";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { project } = useSearch({ from: "__root__" });
  const navigate = useNavigate();

  const projects = useProjectsStore((state) => state.projects);
  const isProjectsLoading = useProjectsStore((state) => state.isLoading);

  const taskList = useTasksStore((state) => state.taskList);
  const loadError = useTasksStore((state) => state.loadError);
  const isEditorOpen = useTasksStore((state) => state.isEditorOpen);
  const editingTask = useTasksStore((state) => state.editingTask);
  const pendingDelete = useTasksStore((state) => state.pendingDelete);
  const actionError = useTasksStore((state) => state.actionError);
  const deleteError = useTasksStore((state) => state.deleteError);
  const loadTasks = useTasksStore((state) => state.loadTasks);
  const openCreateForm = useTasksStore((state) => state.openCreateForm);
  const closeEditor = useTasksStore((state) => state.closeEditor);
  const openEditForm = useTasksStore((state) => state.openEditForm);
  const closeEditForm = useTasksStore((state) => state.closeEditForm);
  const createTask = useTasksStore((state) => state.createTask);
  const toggleTaskCompletion = useTasksStore(
    (state) => state.toggleTaskCompletion,
  );
  const startTaskTimer = useTasksStore((state) => state.startTaskTimer);
  const openDeleteDialog = useTasksStore((state) => state.openDeleteDialog);
  const closeDeleteDialog = useTasksStore((state) => state.closeDeleteDialog);
  const confirmDelete = useTasksStore((state) => state.confirmDelete);
  const updateTask = useTasksStore((state) => state.updateTask);

  const isSidebarCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const [taskForm, setTaskForm] = useState({ title: "", description: "" });
  const [taskFormError, setTaskFormError] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState<TaskEditInput>({
    title: "",
    description: "",
    projectId: 0,
  });
  const [taskEditError, setTaskEditError] = useState("");
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId === null) return;
    void loadTasks(selectedProjectId);
  }, [loadTasks, selectedProjectId]);

  const tasks =
    taskList?.projectId === selectedProjectId ? taskList.tasks : [];
  const tasksError =
    loadError?.projectId === selectedProjectId ? loadError.message : "";
  const isTasksLoading =
    selectedProjectId !== null &&
    taskList?.projectId !== selectedProjectId &&
    loadError?.projectId !== selectedProjectId;

  function openTaskForm() {
    setTaskForm({ title: "", description: "" });
    setTaskFormError("");
    openCreateForm();
  }

  function closeTaskForm() {
    if (!isCreatingTask) closeEditor();
  }

  function openTaskEditForm(task: Task) {
    setTaskEditForm({
      title: task.title,
      description: task.description ?? "",
      projectId: task.project,
    });
    setTaskEditError("");
    openEditForm(task);
  }

  function closeTaskEditForm() {
    if (!isSavingTaskEdit) closeEditForm();
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskForm.title.trim();

    if (!title) {
      setTaskFormError("Podaj tytuł zadania.");
      return;
    }

    const input: TaskInput = {
      title,
      description: taskForm.description.trim(),
      ...(selectedProjectId === null ? {} : { project: selectedProjectId }),
    };

    setIsCreatingTask(true);
    setTaskFormError("");

    try {
      await createTask(input, selectedProjectId);
    } catch (error) {
      setTaskFormError(await apiErrorMessage(error));
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function startTimer(task: Task) {
    if (await startTaskTimer(task)) {
      navigate({ to: "/timer" });
    }
  }

  function closeTaskDeleteDialog() {
    if (!isDeletingTask) closeDeleteDialog();
  }

  async function handleTaskDelete() {
    setIsDeletingTask(true);

    try {
      await confirmDelete();
    } finally {
      setIsDeletingTask(false);
    }
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskEditForm.title.trim();
    const projectId = taskEditForm.projectId;

    if (!title) {
      setTaskEditError("Podaj tytuł zadania.");
      return;
    }
    if (!Number.isInteger(projectId)) {
      setTaskEditError("Wybierz projekt dla zadania.");
      return;
    }

    if (!editingTask) return;

    setIsSavingTaskEdit(true);
    setTaskEditError("");

    try {
      await updateTask(editingTask, {
        title,
        description: taskEditForm.description.trim(),
        projectId,
      });
    } catch (error) {
      setTaskEditError(await apiErrorMessage(error));
    } finally {
      setIsSavingTaskEdit(false);
    }
  }

  if (isProjectsLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie projektów…
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="empty-state">
        <p className="eyebrow">BRAK PROJEKTÓW</p>
        <h1>Utwórz pierwsze miejsce pracy</h1>
        <button
          className="primary-button"
          onClick={() => ShowModal(ProjectEditorModal)}
        >
          Nowy projekt
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`tasks-layout${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
      >
        <ProjectsSidebar
          selectedProjectId={selectedProjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="task-section-heading">
            <div>
              <button
                className="sidebar-open-button"
                onClick={toggleSidebar}
              >
                <span aria-hidden="true">{isSidebarCollapsed ? "»" : "«"}</span>
              </button>
              <h2 id="tasks-heading">Zadania</h2>
            </div>
            <div className="task-heading-actions">
              <span className="task-count">
                {tasks.length} {tasks.length === 1 ? "ZADANIE" : "ZADAŃ"}
              </span>
              <button
                className="primary-button new-task-button"
                onClick={openTaskForm}
              >
                <span aria-hidden="true">+</span>
                Nowe zadanie
              </button>
            </div>
          </div>

          {isTasksLoading ? (
            <p className="task-message" role="status">
              Wczytywanie zadań…
            </p>
          ) : tasksError ? (
            <p className="task-error" role="alert">
              {tasksError}
            </p>
          ) : tasks.length === 0 ? (
            <p className="task-empty-state">Nie ma tu jeszcze zadań.</p>
          ) : (
            <ul className="task-list" aria-label="Zadania">
              {tasks.map((task) => (
                <li
                  className={`task-row${task.isCompleted ? " is-completed" : ""}`}
                  key={task.id}
                >
                  <button
                    className={`task-status-toggle${task.isCompleted ? " is-completed" : ""}`}
                    type="button"
                    aria-label={`${task.isCompleted ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
                    onClick={() => void toggleTaskCompletion(task)}
                  >
                    {task.isCompleted ? "✓" : ""}
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
                      onClick={() => void startTimer(task)}
                    >
                      <span aria-hidden="true">▶</span>
                    </button>
                    <span className="task-status-label">
                      {task.isCompleted ? "UKOŃCZONE" : "OTWARTE"}
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
                      onClick={() => openDeleteDialog(task)}
                    >
                      Usuń
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {actionError && (
            <p className="task-error" role="alert">
              {actionError}
            </p>
          )}
        </section>
      </div>

      {projects.length === 1 && (
        <p className="first-project-note">
          Gdy będziesz gotowy, dodaj projekt, aby oddzielić różne obszary pracy.
        </p>
      )}

      {isEditorOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTaskForm();
          }}
        >
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">NOWE ZADANIE</p>
                <h2 id="task-dialog-title">
                  Dodaj do {selectedProject?.name ?? "Inbox"}
                </h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={closeTaskForm}
                aria-label="Zamknij"
              >
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
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              {taskFormError && (
                <p className="form-error" role="alert">
                  {taskFormError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={closeTaskForm}
                  disabled={isCreatingTask}
                >
                  Anuluj
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isCreatingTask}
                >
                  {isCreatingTask ? "Zapisywanie…" : "Utwórz zadanie"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingTask && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTaskEditForm();
          }}
        >
          <section
            className="project-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-edit-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ZMIANA SZCZEGÓŁÓW</p>
                <h2 id="task-edit-title">Edytuj zadanie</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={closeTaskEditForm}
                aria-label="Zamknij"
              >
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
                  onChange={(event) =>
                    setTaskEditForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="form-field">
                <span>Opis (opcjonalnie)</span>
                <textarea
                  rows={3}
                  value={taskEditForm.description}
                  onChange={(event) =>
                    setTaskEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                <span>Projekt zadania</span>
                <select
                  value={taskEditForm.projectId}
                  onChange={(event) =>
                    setTaskEditForm((current) => ({
                      ...current,
                      projectId: Number(event.target.value),
                    }))
                  }
                  required
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              {taskEditError && (
                <p className="form-error" role="alert">
                  {taskEditError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={closeTaskEditForm}
                  disabled={isSavingTaskEdit}
                >
                  Anuluj
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSavingTaskEdit}
                >
                  {isSavingTaskEdit ? "Zapisywanie…" : "Zapisz zmiany"}
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
            if (event.target === event.currentTarget) closeTaskDeleteDialog();
          }}
        >
          <section
            className="project-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-delete-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">POTWIERDŹ USUNIĘCIE</p>
                <h2 id="task-delete-title">Usunąć zadanie?</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={closeTaskDeleteDialog}
                aria-label="Zamknij"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="confirm-message">
              Zadanie „{pendingDelete.title}" zostanie trwale usunięte. Tej
              operacji nie można cofnąć.
            </p>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="quiet-button"
                type="button"
                onClick={closeTaskDeleteDialog}
                disabled={isDeletingTask}
              >
                Anuluj
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => void handleTaskDelete()}
                disabled={isDeletingTask}
              >
                {isDeletingTask ? "Usuwanie…" : "Usuń zadanie"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
