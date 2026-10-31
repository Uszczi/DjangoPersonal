import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { useProjects } from "@personal/shared/queries/projects";

import { ProjectTasks } from "../../src/ProjectTasks";
import { ScreenHeader } from "../../src/ScreenHeader";
import { TaskListSettingsSheet } from "../../src/TaskListSettingsSheet";
import { taskListSettingsAction } from "../../src/taskListSettings";

/**
 * One Project opened from the Projekty tab: its Tasks, a way to edit it and
 * the task list settings.
 */
export default function ProjectTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const { data: projects = [] } = useProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
                      taskListSettingsAction(() => setIsSettingsOpen(true)),
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
      {isSettingsOpen && (
        <TaskListSettingsSheet onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
