import { Link, router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

import { Fab } from "../../src/Fab";
import { useTheme } from "../../src/theme";

export default function ProjectsScreen() {
  const { common } = useTheme();
  const { data: projects = [], isPending, isError, refetch } = useProjects();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }

  return (
    <View style={common.screen}>
      {isError && <Text style={common.error}>{PROJECTS_LOAD_ERROR}</Text>}
      <FlatList
        data={projects}
        contentContainerStyle={{ paddingBottom: 96 }}
        keyExtractor={(project) => String(project.id)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isPending}
            onRefresh={() => void refresh()}
          />
        }
        renderItem={({ item }) => (
          <Link
            href={{ pathname: "/projects/[id]", params: { id: item.id } }}
            asChild
          >
            <Pressable style={common.row}>
              <View style={{ flex: 1 }}>
                <Text style={common.rowTitle}>{item.name}</Text>
                {item.description !== "" && (
                  <Text style={common.rowSubtitle} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={common.muted}>›</Text>
            </Pressable>
          </Link>
        )}
      />
      <Fab
        accessibilityLabel="Nowy projekt"
        onPress={() => router.push("/project")}
      />
    </View>
  );
}
