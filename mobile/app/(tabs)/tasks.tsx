import { Tabs, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

import { Button } from "../../src/Button";
import { LogoMark } from "../../src/LogoMark";
import { ProjectTasks } from "../../src/ProjectTasks";
import { ScreenHeader } from "../../src/ScreenHeader";
import { Sheet, SheetItem } from "../../src/Sheet";
import {
  selectedTaskProject,
  useTaskProjectStore,
} from "../../src/taskProject";
import { makeStyles, useTheme } from "../../src/theme";

/**
 * The Zadania tab, like the web's Tasks page: the Tasks of one Project. The
 * header's title is the Project's name; tapping it opens the Projects to
 * switch between. Starts on the Inbox and then remembers the last Project
 * chosen.
 */
export default function TasksScreen() {
  const { common } = useTheme();
  const styles = useStyles();
  const { data: projects = [], isPending, isError } = useProjects();
  const projectId = useTaskProjectStore((state) => state.projectId);
  const setProjectId = useTaskProjectStore((state) => state.setProjectId);
  const project = selectedTaskProject(projects, projectId);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

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
          />
        ),
      }}
    />
  );

  if (isError && projects.length === 0) {
    return (
      <View style={common.screen}>
        {header}
        <Text style={styles.error}>{PROJECTS_LOAD_ERROR}</Text>
      </View>
    );
  }

  if (!isPending && project === null) {
    return (
      <View style={[common.screen, styles.empty]}>
        {header}
        <Text style={common.muted}>Utwórz pierwszy projekt.</Text>
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
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  error: { color: colors.danger, padding: 16 },
  empty: { alignItems: "center", justifyContent: "center", gap: 16 },
}));
