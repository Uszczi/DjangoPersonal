import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useProjectsStore } from "@personal/shared/stores/projects";
import { useTasksStore, type TaskInput } from "@personal/shared/stores/tasks";

import { ChipGroup } from "../src/ChipGroup";
import { colors, common } from "../src/theme";

/**
 * Creates a Task (`?projectId=`) or edits one (`?taskId=`), like the web
 * TaskEditorModal. The edited Task comes from the loaded task list, which is
 * the list the user tapped it in.
 */
export default function TaskEditorScreen() {
  const params = useLocalSearchParams<{ projectId?: string; taskId?: string }>();
  const taskId = params.taskId ? Number(params.taskId) : null;

  const projects = useProjectsStore((state) => state.projects);
  const task = useTasksStore((state) =>
    taskId === null
      ? null
      : (state.taskList?.tasks.find((item) => item.id === taskId) ?? null),
  );
  const saveTask = useTasksStore((state) => state.saveTask);

  const [form, setForm] = useState<TaskInput>(() => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    project: task?.projectId ?? Number(params.projectId ?? 0),
    status: task?.status ?? "",
  }));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const targetProject = projects.find((item) => item.id === form.project);
  const statuses = targetProject?.projectStatuses ?? [];
  const selectedStatus =
    form.status && statuses.includes(form.status) ? form.status : statuses[0];

  if (taskId !== null && !task) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono zadania.</Text>
      </View>
    );
  }

  async function submit() {
    const input: TaskInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      project: form.project,
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
      await saveTask(input, task);
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
          title: task ? "Edytuj zadanie" : `Dodaj do ${targetProject?.name ?? "Inbox"}`,
        }}
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Tytuł zadania</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          maxLength={200}
          multiline
          autoFocus={!task}
          autoCapitalize="sentences"
          editable={!isSaving}
        />

        <Text style={styles.label}>Opis (opcjonalnie)</Text>
        <TextInput
          style={[styles.input, styles.description]}
          value={form.description}
          onChangeText={(description) =>
            setForm((current) => ({ ...current, description }))
          }
          multiline
          textAlignVertical="top"
          editable={!isSaving}
        />

        {task && (
          <>
            <Text style={styles.label}>Projekt zadania</Text>
            <ChipGroup
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
              value={form.project}
              onChange={(project) => setForm((current) => ({ ...current, project }))}
              disabled={isSaving}
            />
          </>
        )}

        {statuses.length > 0 && (
          <>
            <Text style={styles.label}>Status</Text>
            <ChipGroup
              options={statuses.map((status) => ({ value: status, label: status }))}
              value={selectedStatus}
              onChange={(status) => setForm((current) => ({ ...current, status }))}
              disabled={isSaving}
            />
          </>
        )}

        {formError !== "" && <Text style={styles.error}>{formError}</Text>}

        {/* In the form, not the header: header buttons can miss taps on Android. */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => router.back()}
            style={[styles.button, styles.buttonSecondary]}
          >
            <Text style={styles.buttonSecondaryText}>Anuluj</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => void submit()}
            style={[styles.button, styles.buttonPrimary, isSaving && styles.buttonDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonPrimaryText}>
                {task ? "Zapisz zmiany" : "Utwórz zadanie"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 8 },
  label: { color: colors.muted, fontSize: 13, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  description: { minHeight: 96 },
  error: { color: colors.danger, marginTop: 8 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonDisabled: { opacity: 0.6 },
  buttonPrimaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  buttonSecondaryText: { color: colors.text, fontSize: 16 },
});
