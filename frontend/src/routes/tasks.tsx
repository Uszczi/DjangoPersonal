import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
  const toggleTaskStatus = useTasksStore((state) => state.toggleTaskStatus);
  const startTaskTimer = useTasksStore((state) => state.startTaskTimer);

  const isSidebarCollapsed = useLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);

  const selectedProjectId = project ?? defaultProject(projects)?.id ?? null;
  const selectedProject =
    projects.find((item) => item.id === selectedProjectId) ?? null;
  const terminalStatus = selectedProject?.terminalStatus;

  useEffect(() => {
    if (selectedProjectId === null) return;
    void loadTasks(selectedProjectId);
  }, [loadTasks, selectedProjectId]);

  const tasks = taskList?.projectId === selectedProjectId ? taskList.tasks : [];
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragOverIdRef = useRef<number | null>(null);
  const touchDragRef = useRef<{
    taskId: number;
    active: boolean;
    longPressTimer: number | null;
  } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  async function handleTaskDrop(draggedTaskId: number, targetId: number) {
    if (draggedTaskId === targetId || selectedProjectId === null) return;
    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    const targetTask = tasks.find((task) => task.id === targetId);
    if (
      !draggedTask ||
      !targetTask ||
      draggedTask.status !== targetTask.status
    )
      return;

    const siblings = tasks.filter(
      (task) => task.status === draggedTask.status,
    );
    const targetIndex = siblings.findIndex((task) => task.id === targetId);

    setDraggedId(null);
    setDragOverId(null);
    dragOverIdRef.current = null;

    try {
      await api.tasksPartialUpdate({
        id: draggedTaskId,
        patchedTaskUpdateRequest: { position: targetIndex },
      });
      await loadTasks(selectedProjectId);
    } catch {
      // ignore; loadTasks will restore server order
      await loadTasks(selectedProjectId);
    }
  }

  // --- Touch drag & drop (long-press on the handle, then drag) ---

  // Latest version of handleTaskDrop, so the document-level listeners in the
  // effect below can always call the current closure.
  const handleTaskDropRef = useRef(handleTaskDrop);
  useEffect(() => {
    handleTaskDropRef.current = handleTaskDrop;
  });

  function beginLongPress(taskId: number) {
    const timer = window.setTimeout(() => {
      if (!touchDragRef.current) return;
      touchDragRef.current.active = true;
      setIsTouchDragging(true);
      setDraggedId(taskId);
    }, 260);
    touchDragRef.current = { taskId, active: false, longPressTimer: timer };
  }

  function cancelTouchDrag() {
    if (touchDragRef.current?.longPressTimer != null) {
      window.clearTimeout(touchDragRef.current.longPressTimer);
    }
    touchDragRef.current = null;
    setIsTouchDragging(false);
    setDraggedId(null);
    dragOverIdRef.current = null;
    setDragOverId(null);
  }

  function endTouchDrag() {
    const state = touchDragRef.current;
    if (!state) return;
    const draggedTaskId = state.taskId;
    const wasActive = state.active;
    const targetId = dragOverIdRef.current;
    cancelTouchDrag();
    if (wasActive && targetId !== null) {
      void handleTaskDropRef.current(draggedTaskId, targetId);
    }
  }

  useEffect(() => {
    if (!isTouchDragging) return;
    function onTouchMove(event: TouchEvent) {
      if (!touchDragRef.current?.active) return;
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const row =
        element instanceof Element ? element.closest("li[data-task-id]") : null;
      if (!row) return;
      const targetId = Number(row.getAttribute("data-task-id"));
      if (!Number.isFinite(targetId)) return;
      dragOverIdRef.current = targetId;
      setDragOverId(targetId);
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", endTouchDrag);
    document.addEventListener("touchcancel", endTouchDrag);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", endTouchDrag);
      document.removeEventListener("touchcancel", endTouchDrag);
    };
  }, [isTouchDragging]);
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
              <span className="task-project-name" title="Aktualny projekt">
                {selectedProject.name}
              </span>
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
                  className={`task-row${terminalStatus != null && task.status === terminalStatus ? " is-completed" : ""}${draggedId === task.id ? " is-dragging" : ""}${dragOverId === task.id ? " is-drag-over" : ""}`}
                  key={task.id}
                  data-task-id={task.id}
                  draggable
                  onDragStart={() => setDraggedId(task.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(task.id);
                    dragOverIdRef.current = task.id;
                  }}
                  onDrop={() => void handleTaskDrop(draggedId ?? task.id, task.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                    dragOverIdRef.current = null;
                  }}
                >
                  <span
                    className="task-drag-handle"
                    aria-label={`Przeciągnij zadanie: ${task.title}`}
                    title="Przeciągnij"
                    onTouchStart={() => beginLongPress(task.id)}
                    onTouchMove={() => {
                      if (touchDragRef.current && !touchDragRef.current.active) {
                        // Scrolling before the long-press fires — not a drag.
                        cancelTouchDrag();
                      }
                    }}
                  >
                    <span aria-hidden="true">⠿</span>
                  </span>
                  <button
                    className={`task-status-toggle${terminalStatus != null && task.status === terminalStatus ? " is-completed" : ""}`}
                    type="button"
                    aria-label={`${terminalStatus != null && task.status === terminalStatus ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
                    onClick={() => void toggleTaskStatus(task)}
                  >
                    {terminalStatus != null && task.status === terminalStatus ? "✓" : ""}
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
          <div className="list-add-row">
            <button className="quiet-button" onClick={openTaskForm}>
              <span aria-hidden="true">+</span>
              Nowe zadanie
            </button>
          </div>
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
