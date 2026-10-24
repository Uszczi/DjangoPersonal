import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import type { TaskResponse } from "@personal/shared/generated/api";
import { useProjectsStore } from "@personal/shared/stores/projects";
import { useTasksStore } from "@personal/shared/stores/tasks";

import { Button } from "../../src/Button";
import { Fab } from "../../src/Fab";
import { colors, common } from "../../src/theme";

type StatusSection = { title: string; data: TaskResponse[] };

/** One section per status, in the Project's order, like the web task list. */
function sectionsByStatus(tasks: TaskResponse[], statuses: string[]): StatusSection[] {
  const order = [...statuses, ...tasks.map((task) => task.status)];
  const titles = [...new Set(order)];
  return titles
    .map((title) => ({ title, data: tasks.filter((task) => task.status === title) }))
    .filter((section) => section.data.length > 0);
}

export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);

  const project = useProjectsStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const taskList = useTasksStore((state) => state.taskList);
  const loadError = useTasksStore((state) => state.loadError);
  const actionError = useTasksStore((state) => state.actionError);
  const loadTasks = useTasksStore((state) => state.loadTasks);
  const toggleTaskStatus = useTasksStore((state) => state.toggleTaskStatus);
  const startTaskTimer = useTasksStore((state) => state.startTaskTimer);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadTasks(projectId);
  }, [loadTasks, projectId]);

  async function refresh() {
    setIsRefreshing(true);
    await loadTasks(projectId);
    setIsRefreshing(false);
  }

  async function startTimer(task: TaskResponse) {
    if (await startTaskTimer(task)) router.navigate("/time");
  }

  // Ignore a list left over from another Project until this one loads.
  const tasks = taskList?.projectId === projectId ? taskList.tasks : null;
  const terminalStatus = project?.terminalStatus;
  const errorMessage =
    loadError?.projectId === projectId ? loadError.message : actionError;
  const sections = sectionsByStatus(tasks ?? [], project?.projectStatuses ?? []);

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
            refreshing={isRefreshing || (tasks === null && !loadError)}
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
            {errorMessage !== "" && <Text style={styles.error}>{errorMessage}</Text>}
          </View>
        }
        ListEmptyComponent={
          tasks !== null ? (
            <Text style={[common.muted, styles.empty]}>Brak zadań w tym projekcie.</Text>
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
                router.push({ pathname: "/task", params: { taskId: item.id } })
              }
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={`${isDone ? "Otwórz zadanie" : "Oznacz jako ukończone"}: ${item.title}`}
                hitSlop={12}
                onPress={() => void toggleTaskStatus(item)}
                style={[styles.checkbox, isDone && styles.checkboxChecked]}
              >
                {isDone && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, isDone && styles.titleDone]}>{item.title}</Text>
                {item.description !== "" && (
                  <Text style={common.muted} numberOfLines={1}>
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
        onPress={() => router.push({ pathname: "/task", params: { projectId } })}
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.muted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.onPrimary, fontSize: 14, fontWeight: "700" },
  title: { fontSize: 16, color: colors.text },
  titleDone: { color: colors.muted, textDecorationLine: "line-through" },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
