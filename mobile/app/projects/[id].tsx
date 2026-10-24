import { Stack, router, useLocalSearchParams } from "expo-router";
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
        contentContainerStyle={styles.listContent}
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
              accessibilityRole="button"
              accessibilityHint="Otwiera edycję zadania"
              onPress={() =>
                router.push({ pathname: "/task", params: { taskId: item.id } })
              }
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={item.title}
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
                <Text style={common.muted}>{item.status}</Text>
              </View>
              <Text style={common.muted}>›</Text>
            </Pressable>
          );
        }}
      />
      {/* In the screen body, not the header: header buttons can miss taps on Android. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dodaj zadanie"
        onPress={() => router.push({ pathname: "/task", params: { projectId } })}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 24, textAlign: "center" },
  listContent: { paddingBottom: 96 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.8 },
  fabLabel: { color: colors.onPrimary, fontSize: 30, lineHeight: 32 },
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
