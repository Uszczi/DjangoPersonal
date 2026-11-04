import { Stack, router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  NestedReorderableList,
  reorderItems,
  ScrollViewContainer,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  useDeleteProject,
  useProjects,
  useSaveProject,
  type ProjectInput,
} from "@personal/shared/queries/projects";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { confirmDestructive } from "@/ui/confirm";
import { useTheme } from "@/theme";
import { common, form } from "@/ui/classes";

/** A status being edited; `id` stays stable while statuses are renamed and reordered. */
type StatusDraft = { id: number; name: string };

let nextStatusId = 1;
function newStatus(name: string): StatusDraft {
  return { id: nextStatusId++, name };
}

/**
 * Creates a Project, or edits one (`?projectId=`), like the web
 * ProjectEditorModal. A status is dragged by its grip to another place, like
 * the Tasks on the Project screen.
 */
export default function ProjectEditorScreen() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId ?? null;
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
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono projektu.</Text>
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

  function moveStatus(from: number, to: number) {
    if (from === to) return;
    setStatuses((current) => reorderItems(current, from, to));
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
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: project ? "Edytuj projekt" : "Nowy projekt" }}
      />
      <ScrollViewContainer
        // The nested reorderable list needs this container; a third-party
        // view takes no className, so `form.content` is spelled out.
        contentContainerStyle={{ gap: 8, padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Nazwa projektu</Text>
        <TextInput
          className={
            project?.isInbox
              ? "rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-muted"
              : form.input
          }
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!project}
          editable={!isSaving && !project?.isInbox}
        />
        {project?.isInbox && (
          <Text className={form.hint}>Nazwa Inbox jest stała.</Text>
        )}

        <Text className={form.label}>Opis (opcjonalnie)</Text>
        <TextInput
          className={form.multiline}
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isSaving}
        />

        <Text className={form.label}>Statusy (w kolejności wyświetlania)</Text>
        <NestedReorderableList
          // The outer ScrollViewContainer scrolls; a scrolling FlatList inside it
          // is the nested-VirtualizedList warning.
          scrollEnabled={false}
          data={statuses}
          keyExtractor={(status) => String(status.id)}
          onReorder={({ from, to }: ReorderableListReorderEvent) =>
            moveStatus(from, to)
          }
          renderItem={({ item: status, index }) => (
            <StatusRow
              status={status}
              index={index}
              disabled={isSaving}
              canRemove={statuses.length > 1}
              onChange={(value) => updateStatus(status.id, value)}
              onRemove={() => removeStatus(status.id)}
            />
          )}
        />
        <View className="flex-row">
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
            <Text className={form.label}>Status końcowy („zrobione”)</Text>
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

        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
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
          <View className={form.actions}>
            <Button
              label="Usuń projekt"
              variant="danger"
              disabled={isSaving}
              onPress={() => void deleteProject()}
            />
          </View>
        )}
      </ScrollViewContainer>
    </KeyboardAvoidingView>
  );
}

/**
 * One status being edited. The grip picks it up after a short press, so the
 * name field keeps its taps and long presses (text selection).
 */
function StatusRow({
  status,
  index,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  status: StatusDraft;
  index: number;
  disabled: boolean;
  canRemove: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  return (
    // A dragged row floats over its neighbours, so it needs its own fill.
    <View className="flex-row items-center gap-1.5 bg-canvas py-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Przenieś status ${index + 1}`}
        accessibilityHint="Przytrzymaj i przeciągnij, aby zmienić kolejność"
        hitSlop={8}
        delayLongPress={150}
        disabled={disabled}
        onLongPress={drag}
        className="h-10 w-7 items-center justify-center"
      >
        <Ionicons name="reorder-three" size={22} color={colors.muted} />
      </Pressable>
      <TextInput
        className={`${form.input} flex-1`}
        value={status.name}
        onChangeText={onChange}
        accessibilityLabel={`Status ${index + 1}`}
        editable={!disabled}
      />
      <IconButton
        label="×"
        accessibilityLabel={`Usuń status ${index + 1}`}
        disabled={disabled || !canRemove}
        onPress={onRemove}
      />
    </View>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={`h-10 w-9 items-center justify-center rounded-[5px] border border-control-border bg-transparent ${disabled ? "opacity-35" : ""}`}
    >
      <Text className="text-[18px] text-icon">{label}</Text>
    </Pressable>
  );
}
