import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  useDeleteProject,
  useProjects,
  useSaveProject,
  type ProjectInput,
} from "@personal/shared/queries/projects";

import { Button } from "../src/ui/Button";
import { ChipGroup } from "../src/ui/ChipGroup";
import { confirmDestructive } from "../src/ui/confirm";
import { makeStyles, useTheme } from "../src/theme";

/** A status being edited; `id` stays stable while statuses are renamed and reordered. */
type StatusDraft = { id: number; name: string };

let nextStatusId = 1;
function newStatus(name: string): StatusDraft {
  return { id: nextStatusId++, name };
}

/**
 * Creates a Project, or edits one (`?projectId=`), like the web
 * ProjectEditorModal. Statuses are reordered with up/down buttons instead of
 * drag and drop.
 */
export default function ProjectEditorScreen() {
  const { common, form } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId ? Number(params.projectId) : null;
  const { data: projects = [] } = useProjects();
  const project =
    projectId === null
      ? null
      : (projects.find((item) => item.id === projectId) ?? null);
  const saveProject = useSaveProject();
  const deleteProjectMutation = useDeleteProject();

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [statuses, setStatuses] = useState(() =>
    (project?.projectStatuses ?? ["Todo", "Zrobione"]).map(newStatus),
  );
  const [terminalStatus, setTerminalStatus] = useState(
    project?.terminalStatus ?? "Zrobione",
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (projectId !== null && !project) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono projektu.</Text>
      </View>
    );
  }

  function updateStatus(id: number, value: string) {
    setStatuses((current) =>
      current.map((status) =>
        status.id === id ? { ...status, name: value } : status,
      ),
    );
  }

  function moveStatus(index: number, offset: -1 | 1) {
    setStatuses((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeStatus(id: number) {
    setStatuses((current) => current.filter((status) => status.id !== id));
  }

  async function submit() {
    const trimmedName = name.trim();
    const names = statuses.map((status) => status.name.trim()).filter(Boolean);

    if (!trimmedName) {
      setFormError("Podaj nazwę projektu.");
      return;
    }
    if (names.length === 0) {
      setFormError("Dodaj przynajmniej jeden status.");
      return;
    }
    if (new Set(names).size !== names.length) {
      setFormError("Statusy nie mogą się powtarzać.");
      return;
    }
    const input: ProjectInput = {
      name: trimmedName,
      description: description.trim(),
      projectStatuses: names,
      terminalStatus: names.includes(terminalStatus)
        ? terminalStatus
        : names[names.length - 1],
    };

    setIsSaving(true);
    setFormError("");
    try {
      const saved = await saveProject.mutateAsync({ input, project });
      if (project) {
        router.back();
      } else {
        router.replace({
          pathname: "/projects/[id]",
          params: { id: saved.id },
        });
      }
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function deleteProject() {
    if (!project) return;
    const confirmed = await confirmDestructive(
      "Usunąć projekt?",
      `Projekt „${project.name}” zostanie trwale usunięty wraz ze wszystkimi jego zadaniami.`,
      "Usuń projekt",
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteProjectMutation.mutateAsync(project);
      // Leave both this form and the deleted Project's task list.
      router.dismissTo("/");
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  const statusNames = statuses
    .map((status) => status.name.trim())
    .filter(Boolean);

  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: project ? "Edytuj projekt" : "Nowy projekt" }}
      />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>Nazwa projektu</Text>
        <TextInput
          style={[form.input, project?.isInbox && styles.readOnly]}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!project}
          editable={!isSaving && !project?.isInbox}
        />
        {project?.isInbox && (
          <Text style={form.hint}>Nazwa Inbox jest stała.</Text>
        )}

        <Text style={form.label}>Opis (opcjonalnie)</Text>
        <TextInput
          style={[form.input, form.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isSaving}
        />

        <Text style={form.label}>Statusy (w kolejności wyświetlania)</Text>
        {statuses.map((status, index) => (
          <View key={status.id} style={styles.statusRow}>
            <TextInput
              style={[form.input, { flex: 1 }]}
              value={status.name}
              onChangeText={(value) => updateStatus(status.id, value)}
              accessibilityLabel={`Status ${index + 1}`}
              editable={!isSaving}
            />
            <IconButton
              label="↑"
              accessibilityLabel={`Przesuń status ${index + 1} wyżej`}
              disabled={isSaving || index === 0}
              onPress={() => moveStatus(index, -1)}
            />
            <IconButton
              label="↓"
              accessibilityLabel={`Przesuń status ${index + 1} niżej`}
              disabled={isSaving || index === statuses.length - 1}
              onPress={() => moveStatus(index, 1)}
            />
            <IconButton
              label="×"
              accessibilityLabel={`Usuń status ${index + 1}`}
              disabled={isSaving || statuses.length <= 1}
              onPress={() => removeStatus(status.id)}
            />
          </View>
        ))}
        <View style={{ flexDirection: "row" }}>
          <Button
            label="+ Dodaj status"
            variant="secondary"
            disabled={isSaving}
            onPress={() =>
              setStatuses((current) => [...current, newStatus("")])
            }
          />
        </View>

        {statusNames.length > 0 && (
          <>
            <Text style={form.label}>Status końcowy („zrobione”)</Text>
            <ChipGroup
              options={statusNames.map((status) => ({
                value: status,
                label: status,
              }))}
              value={
                statusNames.includes(terminalStatus)
                  ? terminalStatus
                  : statusNames[statusNames.length - 1]
              }
              onChange={setTerminalStatus}
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
            label={project ? "Zapisz zmiany" : "Utwórz projekt"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {project && !project.isInbox && (
          <View style={form.actions}>
            <Button
              label="Usuń projekt"
              variant="danger"
              disabled={isSaving}
              onPress={() => void deleteProject()}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function IconButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={[styles.iconButton, disabled && styles.iconButtonDisabled]}
    >
      <Text style={styles.iconButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  readOnly: { color: colors.muted },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: "transparent",
  },
  iconButtonDisabled: { opacity: 0.35 },
  iconButtonLabel: { fontSize: 18, color: colors.icon },
}));
