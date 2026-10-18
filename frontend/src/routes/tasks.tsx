import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DeleteTaskModal } from "@/components/DeleteTaskModal";
import { ProjectEditorModal } from "@/components/ProjectEditorModal";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { TaskEditorModal } from "@/components/TaskEditorModal";
import { useLayoutStore } from "@/stores/layout";
import { ShowModal } from "@/stores/modal";
import { defaultProject, useProjectsStore } from "@/stores/projects";
import { useTasksStore } from "@/stores/tasks";
import { api } from "@/api";
import type { TaskResponse } from "@/generated/api";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

export function TasksPage() {
  const { project } = useSearch({ from: "__root__" });
  const navigate = useNavigate();

  const projects = useProjectsStore((state) => state.projects);
  const isProjectsLoading = useProjectsStore((state) => state.isLoading);

  const taskList = useTasksStore((state) => state.taskList);
  const loadError = useTasksStore((state) => state.loadError);
  const actionError = useTasksStore((state) => state.actionError);
  const loadTasks = useTasksStore((state) => state.loadTasks);
  const toggleTaskCompletion = useTasksStore(
    (state) => state.toggleTaskCompletion,
  );
  const moveTask = useTasksStore((state) => state.moveTask);
  const startTaskTimer = useTasksStore((state) => state.startTaskTimer);

  const isSidebarCollapsed = useLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId === null) return;
    void loadTasks(selectedProjectId);
  }, [loadTasks, selectedProjectId]);

  const tasks = taskList?.projectId === selectedProjectId ? taskList.tasks : [];
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  async function handleTaskDrop(targetId: number) {
    if (
      draggedId === null ||
      draggedId === targetId ||
      selectedProjectId === null
    )
      return;
    const draggedTask = tasks.find((task) => task.id === draggedId);
    const targetTask = tasks.find((task) => task.id === targetId);
    if (
      !draggedTask ||
      !targetTask ||
      draggedTask.isCompleted !== targetTask.isCompleted
    )
      return;

    const siblings = tasks.filter(
      (task) => task.isCompleted === draggedTask.isCompleted,
    );
    const targetIndex = siblings.findIndex((task) => task.id === targetId);

    setDraggedId(null);
    setDragOverId(null);

    try {
      await api.tasksPartialUpdate({
        id: draggedId,
        patchedTaskUpdateRequest: { position: targetIndex },
      });
      await loadTasks(selectedProjectId);
    } catch {
      // ignore; loadTasks will restore server order
      await loadTasks(selectedProjectId);
    }
  }
  const tasksError =
    loadError?.projectId === selectedProjectId ? loadError.message : "";
  const isTasksLoading =
    selectedProjectId !== null &&
    taskList?.projectId !== selectedProjectId &&
    loadError?.projectId !== selectedProjectId;

  function openTaskForm() {
    ShowModal(TaskEditorModal, { projectId: selectedProject?.id });
  }

  function openTaskEditForm(task: TaskResponse) {
    ShowModal(TaskEditorModal, { task });
  }

  function openTaskDeleteDialog(task: TaskResponse) {
    ShowModal(DeleteTaskModal, { task });
  }

  async function startTimer(task: TaskResponse) {
    if (await startTaskTimer(task)) {
      navigate({ to: "/timer" });
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
              <button className="sidebar-open-button" onClick={toggleSidebar}>
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
                  className={`task-row${task.isCompleted ? " is-completed" : ""}${draggedId === task.id ? " is-dragging" : ""}${dragOverId === task.id ? " is-drag-over" : ""}`}
                  key={task.id}
                  draggable
                  onDragStart={() => setDraggedId(task.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(task.id);
                  }}
                  onDrop={() => void handleTaskDrop(task.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                >
                  <span
                    className="task-drag-handle"
                    aria-label={`Przeciągnij zadanie: ${task.title}`}
                    title="Przeciągnij"
                  >
                    <span aria-hidden="true">⠿</span>
                  </span>
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
          {actionError && (
            <p className="task-error" role="alert">
              {actionError}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
