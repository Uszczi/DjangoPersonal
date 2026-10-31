import { Tabs, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

import { Button } from "../../src/ui/Button";
import { LogoMark } from "../../src/ui/LogoMark";
import { ProjectTasks } from "../../src/features/tasks/ProjectTasks";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { Sheet, SheetItem } from "../../src/ui/Sheet";
import { TaskListSettingsSheet } from "../../src/features/tasks/TaskListSettingsSheet";
import { taskListSettingsAction } from "../../src/features/tasks/taskListSettings";
import {
  selectedTaskProject,
  useTaskProjectStore,
} from "../../src/features/tasks/taskProject";
import { common } from "../../src/ui/classes";

/**
 * The Zadania tab, like the web's Tasks page: the Tasks of one Project. The
 * header's title is the Project's name; tapping it opens the Projects to
 * switch between. Starts on the Inbox and then remembers the last Project
 * chosen.
 */
export default function TasksScreen() {
  const { data: projects = [], isPending, isError } = useProjects();
  const projectId = useTaskProjectStore((state) => state.projectId);
  const setProjectId = useTaskProjectStore((state) => state.setProjectId);
  const project = selectedTaskProject(projects, projectId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const header = (
    <Tabs.Screen
      options={{
        header: () => (
          <ScreenHeader
            left={<LogoMark />}
            title={project?.name ?? "Zadania"}
            onTitlePress={
              projects.length > 0 ? () => setIsPickerOpen(true) : undefined
            }
            titleAccessibilityLabel={`Projekt: ${project?.name ?? ""}. Zmień projekt`}
            actions={[taskListSettingsAction(() => setIsSettingsOpen(true))]}
          />
        ),
      }}
    />
  );

  if (isError && projects.length === 0) {
    return (
      <View className={common.screen}>
        {header}
        <Text className="p-4 text-danger">{PROJECTS_LOAD_ERROR}</Text>
      </View>
    );
  }

  if (!isPending && project === null) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas">
        {header}
        <Text className={common.muted}>Utwórz pierwszy projekt.</Text>
        <Button label="Nowy projekt" onPress={() => router.push("/project")} />
      </View>
    );
  }

  return (
    <>
      {header}
      <ProjectTasks
        // A fresh list per Project, so collapsed statuses do not carry over.
        key={project?.id ?? "none"}
        project={project}
      />
      {isPickerOpen && (
        <Sheet title="Projekt" onClose={() => setIsPickerOpen(false)}>
          {projects.map((item) => (
            <SheetItem
              key={item.id}
              icon={item.isInbox ? "file-tray-outline" : "folder-outline"}
              label={item.name}
              isSelected={item.id === project?.id}
              onPress={() => {
                setIsPickerOpen(false);
                setProjectId(item.id);
              }}
            />
          ))}
        </Sheet>
      )}
      {isSettingsOpen && (
        <TaskListSettingsSheet onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
