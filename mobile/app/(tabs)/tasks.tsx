import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { PROJECTS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useProjects } from "@personal/shared/queries/projects";

import { Button } from "../../src/Button";
import { ChipGroup } from "../../src/ChipGroup";
import { ProjectTasks } from "../../src/ProjectTasks";
import {
  selectedTaskProject,
  useTaskProjectStore,
} from "../../src/taskProject";
import { makeStyles, useTheme } from "../../src/theme";

/**
 * The Zadania tab, like the web's Tasks page: the Tasks of one Project, with
 * the Projects as chips on top to switch between them. Starts on the Inbox
 * and then remembers the last Project chosen.
 */
export default function TasksScreen() {
  const { common } = useTheme();
  const styles = useStyles();
  const { data: projects = [], isPending, isError } = useProjects();
  const projectId = useTaskProjectStore((state) => state.projectId);
  const setProjectId = useTaskProjectStore((state) => state.setProjectId);
  const project = selectedTaskProject(projects, projectId);

  if (isError && projects.length === 0) {
    return (
      <View style={common.screen}>
        <Text style={styles.error}>{PROJECTS_LOAD_ERROR}</Text>
      </View>
    );
  }

  if (!isPending && project === null) {
    return (
      <View style={[common.screen, styles.empty]}>
        <Text style={common.muted}>Utwórz pierwszy projekt.</Text>
        <Button label="Nowy projekt" onPress={() => router.push("/project")} />
      </View>
    );
  }

  return (
    <ProjectTasks
      // A fresh list per Project, so collapsed statuses do not carry over.
      key={project?.id ?? "none"}
      project={project}
      header={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <ChipGroup
            nowrap
            options={projects.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            value={project?.id}
            onChange={setProjectId}
          />
        </ScrollView>
      }
    />
  );
}

const useStyles = makeStyles((colors) => ({
  chips: { paddingHorizontal: 16, paddingTop: 16 },
  error: { color: colors.danger, padding: 16 },
  empty: { alignItems: "center", justifyContent: "center", gap: 16 },
}));
