import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { useProjectsStore } from "@personal/shared/stores/projects";

import { Fab } from "../../src/Fab";
import { colors, common } from "../../src/theme";

export default function ProjectsScreen() {
  const projects = useProjectsStore((state) => state.projects);
  const isLoading = useProjectsStore((state) => state.isLoading);
  const pageError = useProjectsStore((state) => state.pageError);
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function refresh() {
    setIsRefreshing(true);
    await loadProjects();
    setIsRefreshing(false);
  }

  return (
    <View style={common.screen}>
      {pageError !== "" && <Text style={common.error}>{pageError}</Text>}
      <FlatList
        data={projects}
        contentContainerStyle={{ paddingBottom: 96 }}
        keyExtractor={(project) => String(project.id)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (isLoading && projects.length === 0)}
            onRefresh={() => void refresh()}
          />
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: "/projects/[id]", params: { id: item.id } }} asChild>
            <Pressable style={common.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>
                  {item.name}
                </Text>
                {item.description !== "" && (
                  <Text style={common.muted} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={common.muted}>›</Text>
            </Pressable>
          </Link>
        )}
      />
      <Fab accessibilityLabel="Nowy projekt" onPress={() => router.push("/project")} />
    </View>
  );
}
