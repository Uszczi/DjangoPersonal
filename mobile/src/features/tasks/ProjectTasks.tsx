import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, RefreshControl, Text, View } from "react-native";
import {
  NestedReorderableList,
  reorderItems,
  ScrollViewContainer,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { scheduleOnRN } from "react-native-worklets";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type {
  ProjectResponse,
  TaskResponse,
} from "@personal/shared/generated/api";
import { TASKS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useMoveTask,
  useProjectTasks,
  useToggleTaskStatus,
} from "@personal/shared/queries/tasks";
import { useStartTimer } from "@personal/shared/queries/timer";

import { Fab } from "../../ui/Fab";
import { useTaskListSettingsStore } from "./taskListSettings";
import { useTheme } from "../../theme";
import { common } from "../../ui/classes";

// A plain boolean, so the drag worklets capture it instead of `Platform`.
const isAndroid = Platform.OS === "android";

type StatusSection = {
  title: string;
  /** How many Tasks have this status, shown even while collapsed. */
  count: number;
  isCollapsed: boolean;
  data: TaskResponse[];
};

/**
 * One section per status, in the Project's order, like the web task list,
 * including statuses with no Tasks yet. A collapsed section keeps its header
 * but renders no rows.
 */
function sectionsByStatus(
  tasks: TaskResponse[],
  statuses: string[],
  collapsed: ReadonlySet<string>,
): StatusSection[] {
  const order = [...statuses, ...tasks.map((task) => task.status)];
  const titles = [...new Set(order)];
  return titles.map((title) => {
    const statusTasks = tasks.filter((task) => task.status === title);
    const isCollapsed = collapsed.has(title);
    return {
      title,
      count: statusTasks.length,
      isCollapsed,
      data: isCollapsed ? [] : statusTasks,
    };
  });
}

/** One row of the task list: a status heading, an empty status's note, or a Task. */
type Row =
  | { kind: "header"; section: StatusSection }
  | { kind: "empty"; status: string }
  | { kind: "task"; task: TaskResponse };

/** The sections as one flat list, so a Task can be dragged past a heading into another status. */
function rowsOf(sections: StatusSection[]): Row[] {
  return sections.flatMap((section): Row[] => [
    { kind: "header", section },
    ...(!section.isCollapsed && section.count === 0
      ? [{ kind: "empty" as const, status: section.title }]
      : []),
    ...section.data.map((task) => ({ kind: "task" as const, task })),
  ]);
}

function rowKey(row: Row): string {
  if (row.kind === "header") return `header:${row.section.title}`;
  if (row.kind === "empty") return `empty:${row.status}`;
  return `task:${row.task.id}`;
}

/**
 * Where a dropped Task lands: the status of the nearest heading above it (the
 * first status when dropped above every heading) and its index among that
 * status's Tasks shown above it.
 */
function dropTarget(
  rows: Row[],
  index: number,
): { status: string; position: number } | null {
  let position = 0;
  for (let i = index - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.kind === "header") return { status: row.section.title, position };
    if (row.kind === "task") position++;
  }
  const first = rows.find((row) => row.kind === "header");
  return first?.kind === "header"
    ? { status: first.section.title, position: 0 }
    : null;
}

/**
 * The Tasks of one Project, one collapsible section per status. All sections
 * are one reorderable list, so a long press drags a Task within its status or
 * past a heading into another one (an empty or collapsed status too), like
 * the web. Shared by the Zadania tab and the Project screen.
 */
export function ProjectTasks({ project }: { project: ProjectResponse | null }) {
  const { colors } = useTheme();
  const projectId = project?.id;

  const tasksQuery = useProjectTasks(project);
  const toggleTaskStatus = useToggleTaskStatus();
  const moveTask = useMoveTask();
  const startTaskTimer = useStartTimer();
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const [actionError, setActionError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedStatuses, setCollapsedStatuses] = useState<
    ReadonlySet<string>
  >(new Set());

  function toggleSection(status: string) {
    setCollapsedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function refresh() {
    setIsRefreshing(true);
    await tasksQuery.refetch();
    setIsRefreshing(false);
  }

  async function toggleTask(task: TaskResponse) {
    setActionError("");
    try {
      await toggleTaskStatus.mutateAsync(task);
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  async function startTimer(task: TaskResponse) {
    setActionError("");
    try {
      await startTaskTimer.mutateAsync({ task: task.id });
    } catch (error) {
      setActionError(await apiErrorMessage(error));
      return;
    }
    router.navigate("/time");
  }

  async function reorder(rows: Row[], from: number, to: number) {
    const dragged = rows[from];
    if (dragged?.kind !== "task" || from === to) return;
    const task = dragged.task;
    const target = dropTarget(reorderItems(rows, from, to), to);
    if (!target) return;
    const isSameStatus = target.status === task.status;
    if (isSameStatus) {
      const before = dropTarget(rows, from);
      if (before?.position === target.position) return;
    }
    setActionError("");
    try {
      // The cached list moves at once; a refused move snaps back on reload.
      await moveTask.mutateAsync({
        task,
        position: target.position,
        status: isSameStatus ? undefined : target.status,
      });
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  // On Android a pull-to-refresh can fight the drag (the library's advice):
  // switch it off while a Task is held.
  const handleDragStart = useCallback(() => {
    "worklet";
    if (isAndroid) scheduleOnRN(setIsDragging, true);
  }, []);
  const handleDragEnd = useCallback(() => {
    "worklet";
    if (isAndroid) scheduleOnRN(setIsDragging, false);
  }, []);

  const tasks = tasksQuery.data ?? null;
  const terminalStatus = project?.terminalStatus;
  const errorMessage = tasksQuery.isError ? TASKS_LOAD_ERROR : actionError;
  const sections = sectionsByStatus(
    tasks ?? [],
    project?.projectStatuses ?? [],
    collapsedStatuses,
  );
  const rows = rowsOf(sections);

  return (
    <View className={common.screen}>
      <ScrollViewContainer
        // A third-party list: no className props, so a plain style.
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            enabled={!isDragging || isRefreshing}
            refreshing={isRefreshing || (tasks === null && !tasksQuery.isError)}
            onRefresh={() => void refresh()}
          />
        }
      >
        <View className="gap-3 p-4">
          {project?.description ? (
            <Text className={common.muted}>{project.description}</Text>
          ) : null}
          {errorMessage !== "" && (
            <Text className="text-danger">{errorMessage}</Text>
          )}
        </View>
        {tasks !== null && sections.length === 0 && (
          <Text className="p-6 text-center text-xs text-muted">
            Brak zadań w tym projekcie.
          </Text>
        )}
        <NestedReorderableList
          data={rows}
          keyExtractor={rowKey}
          onReorder={({ from, to }: ReorderableListReorderEvent) =>
            void reorder(rows, from, to)
          }
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              const section = item.section;
              return (
                <Pressable
                  // A dragged row floats over its neighbours, so it needs its own fill.
                  className="flex-row items-center gap-1.5 bg-canvas px-4 pt-4 pb-1.5"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !section.isCollapsed }}
                  accessibilityLabel={`${section.isCollapsed ? "Rozwiń" : "Zwiń"} status ${section.title}`}
                  onPress={() => toggleSection(section.title)}
                >
                  <Ionicons
                    name={
                      section.isCollapsed ? "chevron-forward" : "chevron-down"
                    }
                    size={14}
                    color={colors.muted}
                  />
                  <Text className="font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
                    {section.title.toUpperCase()} · {section.count}
                  </Text>
                </Pressable>
              );
            }
            if (item.kind === "empty") {
              return (
                <Text className="px-4 py-3 text-[13px] text-muted">
                  Brak w tym statusie.
                </Text>
              );
            }
            const task = item.task;
            return (
              <TaskRow
                task={task}
                isDone={task.status === terminalStatus}
                onOpen={() =>
                  router.push({
                    pathname: "/task",
                    params: { taskId: task.id, projectId },
                  })
                }
                onToggle={() => void toggleTask(task)}
                onStartTimer={
                  showTimerButton ? () => void startTimer(task) : undefined
                }
              />
            );
          }}
        />
      </ScrollViewContainer>
      {project && (
        <Fab
          accessibilityLabel="Dodaj zadanie"
          onPress={() =>
            router.push({ pathname: "/task", params: { projectId } })
          }
        />
      )}
    </View>
  );
}

/**
 * One Task in a reorderable section. A long press anywhere on the row, or a
 * shorter one on the grip, picks it up; taps still open it, tick it off or
 * start its timer, and a plain swipe scrolls the list.
 */
function TaskRow({
  task,
  isDone,
  onOpen,
  onToggle,
  onStartTimer,
}: {
  task: TaskResponse;
  isDone: boolean;
  onOpen: () => void;
  onToggle: () => void;
  /** Absent when the timer button is switched off in the settings. */
  onStartTimer?: () => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();

  return (
    <Pressable
      className="mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line bg-canvas px-[3px] py-2.5"
      accessibilityRole="button"
      accessibilityLabel={`Edytuj zadanie: ${task.title}`}
      accessibilityHint="Przytrzymaj, aby zmienić kolejność lub status"
      onPress={onOpen}
      onLongPress={drag}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${isDone ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
        hitSlop={12}
        onPress={onToggle}
        className={
          isDone
            ? "size-[22px] items-center justify-center rounded border-[1.5px] border-accent bg-accent"
            : "size-[22px] items-center justify-center rounded border-[1.5px] border-control-border-hover"
        }
      >
        {isDone && <Text className="text-sm font-bold text-on-signal">✓</Text>}
      </Pressable>
      <View className="flex-1">
        <Text
          className={
            isDone
              ? "text-sm font-medium text-muted line-through"
              : "text-sm font-medium text-ink"
          }
        >
          {task.title}
        </Text>
        {task.description !== "" && (
          <Text className={common.rowSubtitle} numberOfLines={1}>
            {task.description}
          </Text>
        )}
      </View>
      {!isDone && onStartTimer && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Uruchom timer: ${task.title}`}
          hitSlop={10}
          onPress={onStartTimer}
          className="size-[34px] items-center justify-center rounded-md border border-transparent bg-icon-wash"
        >
          <Ionicons name="play" size={16} color={colors.signal} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Przenieś zadanie: ${task.title}`}
        accessibilityHint="Przytrzymaj i przeciągnij, aby zmienić kolejność lub status"
        hitSlop={8}
        delayLongPress={150}
        onLongPress={drag}
        className="h-[34px] w-7 items-center justify-center"
      >
        <Ionicons name="reorder-three" size={22} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}
