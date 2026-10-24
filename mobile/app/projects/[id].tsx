import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useProjectsStore } from "@personal/shared/stores/projects";
import { useTasksStore } from "@personal/shared/stores/tasks";

import { colors, common } from "../../src/theme";

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadTasks(projectId);
  }, [loadTasks, projectId]);

  async function refresh() {
    setIsRefreshing(true);
    await loadTasks(projectId);
    setIsRefreshing(false);
  }

  // Ignore a list left over from another Project until this one loads.
  const tasks = taskList?.projectId === projectId ? taskList.tasks : null;
  const terminalStatus = project?.terminalStatus;
  const errorMessage =
    loadError?.projectId === projectId ? loadError.message : actionError;

  return (
    <View style={common.screen}>
      <Stack.Screen options={{ title: project?.name ?? "Zadania" }} />
      {errorMessage !== "" && <Text style={common.error}>{errorMessage}</Text>}
      <FlatList
        data={tasks ?? []}
        keyExtractor={(task) => String(task.id)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (tasks === null && !loadError)}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          tasks !== null ? (
            <Text style={[common.muted, styles.empty]}>Brak zadań w tym projekcie.</Text>
          ) : undefined
        }
        renderItem={({ item }) => {
          const isDone = item.status === terminalStatus;
          return (
            <Pressable
              style={common.row}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              onPress={() => void toggleTaskStatus(item)}
            >
              <View style={[styles.checkbox, isDone && styles.checkboxChecked]}>
                {isDone && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, isDone && styles.titleDone]}>{item.title}</Text>
                <Text style={common.muted}>{item.status}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 24, textAlign: "center" },
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
});
