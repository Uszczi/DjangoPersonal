import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useProjects } from "@personal/shared/queries/projects";
import {
  useDeleteTask,
  useProjectTasks,
  useSaveTask,
  type TaskInput,
} from "@personal/shared/queries/tasks";
import {
  initialNewTaskStatus,
  useNewTaskStatusStore,
} from "@personal/shared/stores/newTaskStatus";
import { TASK_TITLE_MAX_LENGTH } from "@personal/shared/taskTitle";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { TagPicker } from "@/features/tasks/TagPicker";
import { TaskComments } from "@/features/tasks/TaskComments";
import { confirmDestructive } from "@/ui/confirm";
import { common, form } from "@/ui/classes";

/**
 * Creates a Task in `?projectId=`, or edits `?taskId=` of that Project, like
 * the web TaskEditorModal. The edited Task comes from the Project's cached
 * task list, which is the list the user tapped it in. Reordering is done by
 * dragging on the Project screen, like the web's drag and drop. An existing
 * Task also shows its comments, where photos can be attached.
 */
export default function TaskEditorScreen() {
  const params = useLocalSearchParams<{
    projectId?: string;
    taskId?: string;
  }>();
  const taskId = params.taskId ?? null;

  const { data: projects = [] } = useProjects();
  const listProject =
    projects.find((item) => item.id === params.projectId) ?? null;
  const { data: listTasks = [] } = useProjectTasks(
    taskId === null ? null : listProject,
  );
  const task =
    taskId === null
      ? null
      : (listTasks.find((item) => item.id === taskId) ?? null);
  const saveTask = useSaveTask();
  const deleteTaskMutation = useDeleteTask();

  const lastStatusByProject = useNewTaskStatusStore(
    (state) => state.lastStatusByProject,
  );
  const rememberStatus = useNewTaskStatusStore((state) => state.rememberStatus);

  const [form_, setForm] = useState<TaskInput>(() => {
    const projectId = task?.projectId ?? params.projectId ?? "";
    return {
      title: task?.title ?? "",
      description: task?.description ?? "",
      project: projectId,
      status:
        task?.status ??
        initialNewTaskStatus(
          lastStatusByProject,
          projectId,
          projects.find((item) => item.id === projectId)?.projectStatuses ?? [],
        ),
      tags: task?.tags ?? [],
    };
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const targetProject = projects.find((item) => item.id === form_.project);
  const statuses = targetProject?.projectStatuses ?? [];
  const selectedStatus =
    form_.status && statuses.includes(form_.status)
      ? form_.status
      : statuses[0];

  if (taskId !== null && !task) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono zadania.</Text>
      </View>
    );
  }

  async function submit() {
    const input: TaskInput = {
      title: form_.title.trim(),
      description: form_.description.trim(),
      project: form_.project,
      status: selectedStatus,
      tags: form_.tags,
    };
    if (!input.title) {
      setFormError("Podaj tytuł zadania.");
      return;
    }
    if (!input.project) {
      setFormError("Wybierz projekt dla zadania.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    try {
      await saveTask.mutateAsync({ input, task });
      if (!task && input.status) rememberStatus(input.project, input.status);
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function deleteTask() {
    if (!task) return;
    const confirmed = await confirmDestructive(
      "Usunąć zadanie?",
      `Zadanie „${task.title}” zostanie trwale usunięte. Tej operacji nie można cofnąć.`,
      "Usuń zadanie",
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteTaskMutation.mutateAsync(task);
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: task
            ? "Edytuj zadanie"
            : `Dodaj do ${targetProject?.name ?? "Inbox"}`,
        }}
      />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Tytuł zadania</Text>
        <TextInput
          className={form.input}
          value={form_.title}
          onChangeText={(title) =>
            setForm((current) => ({ ...current, title }))
          }
          maxLength={TASK_TITLE_MAX_LENGTH}
          multiline
          autoFocus={!task}
          autoCapitalize="sentences"
          editable={!isSaving}
        />

        <Text className={form.label}>Opis (opcjonalnie)</Text>
        <TextInput
          className={form.multiline}
          value={form_.description}
          onChangeText={(description) =>
            setForm((current) => ({ ...current, description }))
          }
          multiline
          editable={!isSaving}
        />

        {task && (
          <>
            <Text className={form.label}>Projekt zadania</Text>
            <ChipGroup
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              value={form_.project}
              onChange={(project) =>
                setForm((current) => ({ ...current, project }))
              }
              disabled={isSaving}
            />
          </>
        )}

        {statuses.length > 0 && (
          <>
            <Text className={form.label}>Status</Text>
            <ChipGroup
              options={statuses.map((status) => ({
                value: status,
                label: status,
              }))}
              value={selectedStatus}
              onChange={(status) =>
                setForm((current) => ({ ...current, status }))
              }
              disabled={isSaving}
            />
          </>
        )}

        <TagPicker
          value={form_.tags ?? []}
          onChange={(tags) => setForm((current) => ({ ...current, tags }))}
          disabled={isSaving}
        />

        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label={task ? "Zapisz zmiany" : "Utwórz zadanie"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>

        {task && (
          <View className={form.actions}>
            <Button
              label="Usuń zadanie"
              variant="danger"
              disabled={isSaving}
              onPress={() => void deleteTask()}
            />
          </View>
        )}

        {task && <TaskComments task={task} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
