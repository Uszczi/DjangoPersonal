import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TaskResponse } from "@personal/shared/generated/api";
import { TASKS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";
import {
  useProjectTasks,
  useToggleTaskStatus,
} from "@personal/shared/queries/tasks";
import { useStartTimer } from "@personal/shared/queries/timer";

import { Button } from "../../src/Button";
import { Fab } from "../../src/Fab";
import { colors, common, fonts } from "../../src/theme";

type StatusSection = { title: string; data: TaskResponse[] };

/** One section per status, in the Project's order, like the web task list. */
function sectionsByStatus(
  tasks: TaskResponse[],
  statuses: string[],
): StatusSection[] {
  const order = [...statuses, ...tasks.map((task) => task.status)];
  const titles = [...new Set(order)];
  return titles
    .map((title) => ({
      title,
      data: tasks.filter((task) => task.status === title),
    }))
    .filter((section) => section.data.length > 0);
}

export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);

  const { data: projects = [] } = useProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;
  const tasksQuery = useProjectTasks(project);
  const toggleTaskStatus = useToggleTaskStatus();
  const startTaskTimer = useStartTimer();
  const [actionError, setActionError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const tasks = tasksQuery.data ?? null;
  const terminalStatus = project?.terminalStatus;
  const errorMessage = tasksQuery.isError ? TASKS_LOAD_ERROR : actionError;
  const sections = sectionsByStatus(
    tasks ?? [],
    project?.projectStatuses ?? [],
  );

  return (
    <View style={common.screen}>
      <Stack.Screen options={{ title: project?.name ?? "Zadania" }} />
      <SectionList
        sections={sections}
        keyExtractor={(task) => String(task.id)}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (tasks === null && !tasksQuery.isError)}
            onRefresh={() => void refresh()}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {project?.description ? (
              <Text style={common.muted}>{project.description}</Text>
            ) : null}
            {project && (
              <View style={{ flexDirection: "row" }}>
                <Button
                  label="Edytuj projekt"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: "/project", params: { projectId } })
                  }
                />
              </View>
            )}
            {errorMessage !== "" && (
              <Text style={styles.error}>{errorMessage}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          tasks !== null ? (
            <Text style={[common.muted, styles.empty]}>
              Brak zadań w tym projekcie.
            </Text>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>
            {section.title.toUpperCase()} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => {
          const isDone = item.status === terminalStatus;
          return (
            <Pressable
              style={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj zadanie: ${item.title}`}
              onPress={() =>
                router.push({
                  pathname: "/task",
                  params: { taskId: item.id, projectId },
                })
              }
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={`${isDone ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${item.title}`}
                hitSlop={12}
                onPress={() => void toggleTask(item)}
                style={[styles.checkbox, isDone && styles.checkboxChecked]}
              >
                {isDone && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, isDone && styles.titleDone]}>
                  {item.title}
                </Text>
                {item.description !== "" && (
                  <Text style={common.rowSubtitle} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              {!isDone && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Uruchom timer: ${item.title}`}
                  hitSlop={10}
                  onPress={() => void startTimer(item)}
                  style={styles.play}
                >
                  <Ionicons name="play" size={16} color={colors.primary} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
      <Fab
        accessibilityLabel="Dodaj zadanie"
        onPress={() =>
          router.push({ pathname: "/task", params: { projectId } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 12 },
  error: { color: colors.danger },
  empty: { padding: 24, textAlign: "center" },
  listContent: { paddingBottom: 96 },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
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
  checkmark: { color: colors.onPrimary, fontSize: 14, fontWeight: "700" },
  title: { fontSize: 14, fontWeight: "500", color: colors.text },
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
});
