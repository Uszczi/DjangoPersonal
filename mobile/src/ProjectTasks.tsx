import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Platform, Pressable, RefreshControl, Text, View } from "react-native";
import {
  NestedReorderableList,
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

import { Fab } from "./Fab";
import { makeStyles, fonts, useTheme } from "./theme";

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

/**
 * The Tasks of one Project, one collapsible section per status. Each section
 * is its own reorderable list, so a long press drags a Task only within its
 * status, the same constraint as the web, where Tasks are ordered within
 * their status. Shared by the Zadania tab and the Project screen; `header`
 * goes above the list, inside its scroll view.
 */
export function ProjectTasks({
  project,
  header,
}: {
  project: ProjectResponse | null;
  header?: ReactNode;
}) {
  const { colors, common } = useTheme();
  const styles = useStyles();
  const projectId = project?.id;

  const tasksQuery = useProjectTasks(project);
  const toggleTaskStatus = useToggleTaskStatus();
  const moveTask = useMoveTask();
  const startTaskTimer = useStartTimer();
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

  async function reorder(section: StatusSection, from: number, to: number) {
    const task = section.data[from];
    if (!task || from === to) return;
    setActionError("");
    try {
      // The cached list moves at once; a refused move snaps back on reload.
      await moveTask.mutateAsync({ task, position: to });
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

  return (
    <View style={common.screen}>
      <ScrollViewContainer
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            enabled={!isDragging || isRefreshing}
            refreshing={isRefreshing || (tasks === null && !tasksQuery.isError)}
            onRefresh={() => void refresh()}
          />
        }
      >
        {header}
        <View style={styles.header}>
          {project?.description ? (
            <Text style={common.muted}>{project.description}</Text>
          ) : null}
          {errorMessage !== "" && (
            <Text style={styles.error}>{errorMessage}</Text>
          )}
        </View>
        {tasks !== null && sections.length === 0 && (
          <Text style={[common.muted, styles.empty]}>
            Brak zadań w tym projekcie.
          </Text>
        )}
        {sections.map((section) => (
          <View key={section.title}>
            <Pressable
              style={styles.sectionHeader}
              accessibilityRole="button"
              accessibilityState={{ expanded: !section.isCollapsed }}
              accessibilityLabel={`${section.isCollapsed ? "Rozwiń" : "Zwiń"} status ${section.title}`}
              onPress={() => toggleSection(section.title)}
            >
              <Ionicons
                name={section.isCollapsed ? "chevron-forward" : "chevron-down"}
                size={14}
                color={colors.muted}
              />
              <Text style={styles.sectionTitle}>
                {section.title.toUpperCase()} · {section.count}
              </Text>
            </Pressable>
            {!section.isCollapsed && section.count === 0 && (
              <Text style={[common.muted, styles.sectionEmpty]}>
                Brak w tym statusie.
              </Text>
            )}
            {!section.isCollapsed && (
              <NestedReorderableList
                data={section.data}
                keyExtractor={(task) => String(task.id)}
                onReorder={({ from, to }: ReorderableListReorderEvent) =>
                  void reorder(section, from, to)
                }
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                renderItem={({ item }) => (
                  <TaskRow
                    task={item}
                    isDone={item.status === terminalStatus}
                    onOpen={() =>
                      router.push({
                        pathname: "/task",
                        params: { taskId: item.id, projectId },
                      })
                    }
                    onToggle={() => void toggleTask(item)}
                    onStartTimer={() => void startTimer(item)}
                  />
                )}
              />
            )}
          </View>
        ))}
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
  onStartTimer: () => void;
}) {
  const { colors, common } = useTheme();
  const styles = useStyles();
  const drag = useReorderableDrag();

  return (
    <Pressable
      style={[common.row, styles.row]}
      accessibilityRole="button"
      accessibilityLabel={`Edytuj zadanie: ${task.title}`}
      accessibilityHint="Przytrzymaj, aby zmienić kolejność"
      onPress={onOpen}
      onLongPress={drag}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${isDone ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${task.title}`}
        hitSlop={12}
        onPress={onToggle}
        style={[styles.checkbox, isDone && styles.checkboxChecked]}
      >
        {isDone && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, isDone && styles.titleDone]}>
          {task.title}
        </Text>
        {task.description !== "" && (
          <Text style={common.rowSubtitle} numberOfLines={1}>
            {task.description}
          </Text>
        )}
      </View>
      {!isDone && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Uruchom timer: ${task.title}`}
          hitSlop={10}
          onPress={onStartTimer}
          style={styles.play}
        >
          <Ionicons name="play" size={16} color={colors.signal} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Przenieś zadanie: ${task.title}`}
        accessibilityHint="Przytrzymaj i przeciągnij, aby zmienić kolejność"
        hitSlop={8}
        delayLongPress={150}
        onLongPress={drag}
        style={styles.grip}
      >
        <Ionicons name="reorder-three" size={22} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { padding: 16, gap: 12 },
  error: { color: colors.danger },
  empty: { padding: 24, textAlign: "center" },
  sectionEmpty: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 13 },
  listContent: { paddingBottom: 96 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
  // A dragged row floats over its neighbours, so it needs its own fill.
  row: { backgroundColor: colors.canvas },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.controlBorderHover,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: { color: colors.onSignal, fontSize: 14, fontWeight: "700" },
  title: { fontSize: 14, fontWeight: "500", color: colors.ink },
  titleDone: { color: colors.muted, textDecorationLine: "line-through" },
  play: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: colors.iconWash,
    alignItems: "center",
    justifyContent: "center",
  },
  grip: {
    width: 28,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
}));
