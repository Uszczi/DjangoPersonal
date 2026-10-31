import { Link, router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

import { Fab } from "../../src/ui/Fab";
import { common } from "../../src/ui/classes";

/** The Projekty tab: the user's Projects, each opening its Tasks. */
export default function ProjectsScreen() {
  const { data: projects = [], isPending, isError, refetch } = useProjects();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }

  return (
    <View className={common.screen}>
      {isError && <Text className={common.error}>{PROJECTS_LOAD_ERROR}</Text>}
      <FlatList
        data={projects}
        contentContainerClassName="pb-24"
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
            <Pressable className={common.row}>
              <View className="flex-1">
                <Text className={common.rowTitle}>{item.name}</Text>
                {item.description !== "" && (
                  <Text className={common.rowSubtitle} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text className={common.muted}>›</Text>
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
