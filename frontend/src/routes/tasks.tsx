import { createFileRoute } from "@tanstack/react-router";

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiErrorMessage } from "../apiErrorMessage";
import { useLayoutContext } from "../layoutContext";
import { Configuration, TasksApi, TimerApi, type Task } from "../generated/api";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

const tasksApi = new TasksApi(new Configuration({ basePath: "" }));
const timerApi = new TimerApi(new Configuration({ basePath: "" }));

type TaskInput = { title: string; description: string; project?: number };
type TaskEditInput = { title: string; description: string; projectId: string };

function orderTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted)
      return left.isCompleted ? 1 : -1;
    return left.id - right.id;
  });
}

function TasksPage() {
  const {
    projects,
    selectedProjectId,
    isLoading,
    onNewProject,
  } = useLayoutContext();
  const navigate = useNavigate();
  const [loadedTaskList, setLoadedTaskList] = useState<{
    projectId: number;
    tasks: Task[];
  } | null>(null);
  const [taskLoadError, setTaskLoadError] = useState<{
    projectId: number;
    message: string;
  } | null>(null);
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });
  const [taskFormError, setTaskFormError] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskEditForm, setTaskEditForm] = useState<TaskEditInput>({
    title: "",
    description: "",
    projectId: "",
  });
  const [taskEditError, setTaskEditError] = useState("");
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState(false);
  const [taskActionError, setTaskActionError] = useState("");
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [taskDeleteError, setTaskDeleteError] = useState("");

  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId === null) return;

    let isCurrent = true;

    tasksApi
      .tasksList({ project: selectedProjectId })
      .then((loadedTasks) => {
        if (!isCurrent) return;
        setLoadedTaskList({
          projectId: selectedProjectId,
          tasks: orderTasks(loadedTasks),
        });
        setTaskLoadError(null);
      })
      .catch(() => {
        if (isCurrent) {
          setTaskLoadError({
            projectId: selectedProjectId,
            message: "Nie udało się wczytać zadań. Spróbuj ponownie.",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedProjectId]);

  const tasks =
    loadedTaskList?.projectId === selectedProjectId ? loadedTaskList.tasks : [];
  const tasksError =
    taskLoadError?.projectId === selectedProjectId ? taskLoadError.message : "";
  const isTasksLoading =
    selectedProjectId !== null &&
    loadedTaskList?.projectId !== selectedProjectId &&
    taskLoadError?.projectId !== selectedProjectId;

  function openTaskForm() {
    setTaskForm({ title: "", description: "" });
    setTaskFormError("");
    setIsTaskEditorOpen(true);
  }

  function closeTaskForm() {
    if (!isCreatingTask) setIsTaskEditorOpen(false);
  }

  function openTaskEditForm(task: Task) {
    setTaskEditForm({
      title: task.title,
      description: task.description ?? "",
      projectId: String(task.project),
    });
    setTaskEditError("");
    setEditingTask(task);
  }

  function closeTaskEditForm() {
    if (!isSavingTaskEdit) setEditingTask(null);
  }

  function updateTaskList(previousTask: Task, updatedTask: Task) {
    setLoadedTaskList((current) => {
      if (!current) return current;

      const currentTasks = current.tasks;
      const taskWasVisible = currentTasks.some(
        (task) => task.id === previousTask.id,
      );
      const taskBelongsInList = updatedTask.project === current.projectId;
      if (!taskWasVisible && !taskBelongsInList) return current;

      const visibleTasks = taskBelongsInList
        ? [
            ...currentTasks.filter((task) => task.id !== updatedTask.id),
            updatedTask,
          ]
        : currentTasks.filter((task) => task.id !== updatedTask.id);

      return { projectId: current.projectId, tasks: orderTasks(visibleTasks) };
    });
    setTaskLoadError((current) =>
      current &&
      (current.projectId === previousTask.project ||
        current.projectId === updatedTask.project)
        ? null
        : current,
    );
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
      const createdTask = await tasksApi.tasksCreate({
        taskCreateRequest: input,
      });
      if (selectedProjectId !== null) {
        setLoadedTaskList((current) => ({
          projectId: selectedProjectId,
          tasks: orderTasks([
            ...(current?.projectId === selectedProjectId ? current.tasks : []),
            createdTask,
          ]),
        }));
      }
      setTaskLoadError(null);
      setIsTaskEditorOpen(false);
    } catch (error) {
      setTaskFormError(await apiErrorMessage(error));
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function toggleTaskCompletion(task: Task) {
    setTaskActionError("");

    try {
      const updatedTask = await tasksApi.tasksPartialUpdate({
        id: task.id,
        patchedTaskUpdateRequest: { isCompleted: !task.isCompleted },
      });
      updateTaskList(task, updatedTask);
    } catch (error) {
      setTaskActionError(await apiErrorMessage(error));
    }
  }

  async function startTaskTimer(task: Task) {
    setTaskActionError("");

    try {
      await timerApi.timerStart({ timerStartRequest: { task: task.id } });
      navigate({ to: "/timer" });
    } catch (error) {
      setTaskActionError(await apiErrorMessage(error));
    }
  }

  function openTaskDeleteDialog(task: Task) {
    setTaskDeleteError("");
    setTaskPendingDelete(task);
  }

  function closeTaskDeleteDialog() {
    if (!isDeletingTask) setTaskPendingDelete(null);
  }

  async function confirmTaskDelete() {
    if (!taskPendingDelete) return;

    setIsDeletingTask(true);
    setTaskDeleteError("");

    try {
      const deletedTask = taskPendingDelete;
      await tasksApi.tasksDestroy({ id: deletedTask.id });
      setLoadedTaskList((current) =>
        current
          ? {
              projectId: current.projectId,
              tasks: current.tasks.filter((task) => task.id !== deletedTask.id),
            }
          : current,
      );
      setTaskPendingDelete(null);
    } catch (error) {
      setTaskDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeletingTask(false);
    }
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskEditForm.title.trim();
    const projectId = Number(taskEditForm.projectId);

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
      const updatedTask = await tasksApi.tasksPartialUpdate({
        id: editingTask.id,
        patchedTaskUpdateRequest: {
          title,
          description: taskEditForm.description.trim(),
          project: projectId,
        },
      });
      updateTaskList(editingTask, updatedTask);
      setEditingTask(null);
    } catch (error) {
      setTaskEditError(await apiErrorMessage(error));
    } finally {
      setIsSavingTaskEdit(false);
    }
  }

  if (isLoading) {
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
        <button className="primary-button" onClick={onNewProject}>
          Nowy projekt
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="tasks-section" aria-labelledby="tasks-heading">
        <div className="task-section-heading">
          <div>
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
                    onClick={() => void startTaskTimer(task)}
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
                    onClick={() => openTaskDeleteDialog(task)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {taskActionError && (
          <p className="task-error" role="alert">
            {taskActionError}
          </p>
        )}
      </section>

      {projects.length === 1 && (
        <p className="first-project-note">
          Gdy będziesz gotowy, dodaj projekt, aby oddzielić różne obszary pracy.
        </p>
      )}

      {isTaskEditorOpen && (
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
                      projectId: event.target.value,
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

      {taskPendingDelete && (
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
              Zadanie „{taskPendingDelete.title}" zostanie trwale usunięte. Tej
              operacji nie można cofnąć.
            </p>
            {taskDeleteError && (
              <p className="form-error" role="alert">
                {taskDeleteError}
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
                onClick={() => void confirmTaskDelete()}
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
