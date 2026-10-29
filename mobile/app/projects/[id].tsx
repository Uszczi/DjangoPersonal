import { Stack, router, useLocalSearchParams } from "expo-router";

import { useProjects } from "@personal/shared/queries/projects";

import { ProjectTasks } from "../../src/ProjectTasks";
import { ScreenHeader } from "../../src/ScreenHeader";

/** One Project opened from the Projekty tab: its Tasks, and a way to edit it. */
export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const { data: projects = [] } = useProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;

  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <ScreenHeader
              title={project?.name ?? "Zadania"}
              actions={
                project
                  ? [
                      {
                        icon: "pencil",
                        accessibilityLabel: "Edytuj projekt",
                        onPress: () =>
                          router.push({
                            pathname: "/project",
                            params: { projectId },
                          }),
                      },
                    ]
                  : []
              }
            />
          ),
        }}
      />
      <ProjectTasks project={project} />
    </>
  );
}
