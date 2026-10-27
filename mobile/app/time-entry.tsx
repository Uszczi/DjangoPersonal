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
import {
  defaultProject,
  useProjectsStore,
} from "@personal/shared/stores/projects";
import { useTimerStore } from "@personal/shared/stores/timer";
import {
  dateFromKey,
  dateKey,
  entryMinutes,
  todayKey,
} from "@personal/shared/timeFormat";

import { Button } from "../src/Button";
import { ChipGroup } from "../src/ChipGroup";
import { confirmDestructive } from "../src/confirm";
import { DateTimeField } from "../src/DateTimeField";
import { TitleSuggestions } from "../src/TitleSuggestions";
import { common, form } from "../src/theme";

function validate(date: string, title: string, minutes: number) {
  if (!date) return "Podaj datę wpisu.";
  if (!title) return "Podaj tytuł zadania.";
  if (!Number.isInteger(minutes) || minutes < 1) {
    return "Podaj czas trwania w minutach (co najmniej 1).";
  }
  return "";
}

/** Adds a time entry by hand, or edits one (`?entryId=`), like the web Timer page's forms. */
export default function TimeEntryEditorScreen() {
  const params = useLocalSearchParams<{ entryId?: string }>();
  const entryId = params.entryId ? Number(params.entryId) : null;

  const projects = useProjectsStore((state) => state.projects);
  const entries = useTimerStore((state) => state.entries);
  const tasks = useTimerStore((state) => state.tasks);
  const addManualEntry = useTimerStore((state) => state.addManualEntry);
  const updateEntry = useTimerStore((state) => state.updateEntry);
  const deleteEntry = useTimerStore((state) => state.deleteEntry);
  const entry =
    entryId === null
      ? null
      : (entries.find((item) => item.id === entryId) ?? null);

  const [date, setDate] = useState(() =>
    entry ? dateKey(entry.start) : todayKey(),
  );
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState(() => {
    if (!entry) return "";
    if (entry.title) return entry.title;
    return entry.taskId != null
      ? (tasks.find((task) => task.id === entry.taskId)?.title ?? "")
      : "";
  });
  const [minutes, setMinutes] = useState(() =>
    entry ? String(entryMinutes(entry)) : "",
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (entryId !== null && !entry) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono wpisu.</Text>
      </View>
    );
  }

  const chosenProjectId = projectId ?? defaultProject(projects)?.id ?? null;
  // A new entry suggests the chosen Project's Tasks; an edited one any Task.
  const suggestedTasks = entry
    ? tasks
    : tasks.filter((task) => task.projectId === chosenProjectId);

  async function submit() {
    const input = { date, title: title.trim(), minutes: Number(minutes) };
    const problem = validate(input.date, input.title, input.minutes);
    if (problem) {
      setFormError(problem);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (entry) {
        await updateEntry(entry, input);
      } else {
        await addManualEntry(input);
      }
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!entry) return;
    const confirmed = await confirmDestructive(
      "Usunąć wpis?",
      "Wpis czasu zostanie trwale usunięty.",
      "Usuń wpis",
    );
    if (!confirmed) return;
    setIsSaving(true);
    await deleteEntry(entry);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: entry ? "Edytuj wpis" : "Dodaj wpis ręcznie" }}
      />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>Data</Text>
        <DateTimeField
          mode="date"
          value={dateFromKey(date)}
          onChange={(value) => setDate(dateKey(value))}
          disabled={isSaving}
        />

        {!entry && (
          <>
            <Text style={form.label}>Projekt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChipGroup
                options={projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                }))}
                value={chosenProjectId ?? undefined}
                onChange={(id) => {
                  setProjectId(id);
                  setTitle("");
                }}
                disabled={isSaving}
                nowrap
              />
            </ScrollView>
          </>
        )}

        <Text style={form.label}>Zadanie</Text>
        <TextInput
          style={form.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Tytuł zadania"
          editable={!isSaving}
        />
        <TitleSuggestions
          tasks={suggestedTasks}
          query={title}
          onPick={setTitle}
          disabled={isSaving}
        />

        <Text style={form.label}>Czas (minuty)</Text>
        <TextInput
          style={form.input}
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="number-pad"
          maxLength={4}
          editable={!isSaving}
        />

        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label={entry ? "Zapisz zmiany" : "Dodaj wpis"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {entry && (
          <View style={form.actions}>
            <Button
              label="Usuń wpis"
              variant="danger"
              disabled={isSaving}
              onPress={() => void remove()}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
