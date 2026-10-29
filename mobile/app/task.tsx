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

import { Button } from "../src/Button";
import { ChipGroup } from "../src/ChipGroup";
import { confirmDestructive } from "../src/confirm";
import { useTheme } from "../src/theme";

/**
 * Creates a Task in `?projectId=`, or edits `?taskId=` of that Project, like
 * the web TaskEditorModal. The edited Task comes from the Project's cached
 * task list, which is the list the user tapped it in. Reordering is done by
 * dragging on the Project screen, like the web's drag and drop.
 */
export default function TaskEditorScreen() {
  const { common, form } = useTheme();
  const params = useLocalSearchParams<{
    projectId?: string;
    taskId?: string;
  }>();
  const taskId = params.taskId ? Number(params.taskId) : null;

  const { data: projects = [] } = useProjects();
  const listProject =
    projects.find((item) => item.id === Number(params.projectId)) ?? null;
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
    const projectId = task?.projectId ?? Number(params.projectId ?? 0);
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
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono zadania.</Text>
      </View>
    );
  }

  async function submit() {
    const input: TaskInput = {
      title: form_.title.trim(),
      description: form_.description.trim(),
      project: form_.project,
      status: selectedStatus,
    };
    if (!input.title) {
      setFormError("Podaj tytuł zadania.");
      return;
    }
    if (!Number.isInteger(input.project) || input.project <= 0) {
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
      style={common.screen}
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
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>Tytuł zadania</Text>
        <TextInput
          style={form.input}
          value={form_.title}
          onChangeText={(title) =>
            setForm((current) => ({ ...current, title }))
          }
          maxLength={200}
          multiline
          autoFocus={!task}
          autoCapitalize="sentences"
          editable={!isSaving}
        />

        <Text style={form.label}>Opis (opcjonalnie)</Text>
        <TextInput
          style={[form.input, form.multiline]}
          value={form_.description}
          onChangeText={(description) =>
            setForm((current) => ({ ...current, description }))
          }
          multiline
          editable={!isSaving}
        />

        {task && (
          <>
            <Text style={form.label}>Projekt zadania</Text>
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
            <Text style={form.label}>Status</Text>
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

        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
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
          <View style={form.actions}>
            <Button
              label="Usuń zadanie"
              variant="danger"
              disabled={isSaving}
              onPress={() => void deleteTask()}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
