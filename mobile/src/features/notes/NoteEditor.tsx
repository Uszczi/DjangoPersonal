import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { WhiteboardResponse } from "@personal/shared/generated/api";
import {
  noteMarkdown,
  useDeleteWhiteboard,
  useRenameWhiteboard,
  useSaveNoteMarkdown,
} from "@personal/shared/queries/whiteboards";
import { useAutosave } from "@personal/shared/useAutosave";

import { ChipGroup } from "@/ui/ChipGroup";
import { common } from "@/ui/classes";
import { confirmDestructive } from "@/ui/confirm";
import { ScreenHeader } from "@/ui/ScreenHeader";

import { MarkdownView } from "@/features/notes/MarkdownView";

type Mode = "preview" | "edit";

const MODES: { value: Mode; label: string }[] = [
  { value: "preview", label: "Podgląd" },
  { value: "edit", label: "Edycja" },
];

const SAVE_LABELS = {
  saving: "ZAPISYWANIE…",
  failed: "BŁĄD ZAPISU",
  saved: "ZAPISANO",
} as const;

/**
 * An open Notatka: its name (saved when editing ends), the Markdown text
 * autosaved half a second after typing stops, and a switch between the
 * rendered text and the source. Pending text is saved when the app goes to
 * the background and when the screen closes, so nothing typed is lost.
 */
export function NoteEditor({
  note,
  searchQuery = "",
}: {
  note: WhiteboardResponse;
  /** A Notatnik search to mark in the rendered text. */
  searchQuery?: string;
}) {
  const id = note.id;
  const [markdown, setMarkdown] = useState(() => noteMarkdown(note));
  const [mode, setMode] = useState<Mode>(markdown === "" ? "edit" : "preview");
  const [name, setName] = useState(note.name);
  const [savedName, setSavedName] = useState(note.name);
  const [error, setError] = useState("");
  const rename = useRenameWhiteboard();
  const saveMarkdown = useSaveNoteMarkdown();
  const deleteNote = useDeleteWhiteboard();

  const { mutateAsync } = saveMarkdown;
  const save = useCallback(
    async (text: string) => {
      await mutateAsync({ id, markdown: text });
    },
    [id, mutateAsync],
  );
  const { saveState, schedule, flush } = useAutosave(save);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  function changeText(text: string) {
    setMarkdown(text);
    schedule(text);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === savedName) {
      setName(savedName);
      return;
    }
    setError("");
    try {
      const updated = await rename.mutateAsync({ id, name: trimmed });
      setName(updated.name);
      setSavedName(updated.name);
    } catch (err) {
      setName(savedName);
      setError(await apiErrorMessage(err));
    }
  }

  async function remove() {
    const confirmed = await confirmDestructive(
      "Usunąć notatkę?",
      `„${savedName}” zostanie usunięta.`,
      "Usuń",
    );
    if (!confirmed) return;
    try {
      // Whatever is still waiting to be saved goes first, so the closing
      // screen has nothing left to send to a deleted Notatka.
      await flush();
      await deleteNote.mutateAsync(id);
      router.back();
    } catch (err) {
      setError(await apiErrorMessage(err));
    }
  }

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          header: () => (
            <ScreenHeader
              title="Notatka"
              actions={[
                {
                  icon: "folder-open-outline",
                  accessibilityLabel: "Przenieś do folderu",
                  onPress: () =>
                    router.push({
                      pathname: "/move-to-folder",
                      params: { target: "item", id },
                    }),
                },
                {
                  icon: "trash-outline",
                  accessibilityLabel: "Usuń notatkę",
                  onPress: () => void remove(),
                },
              ]}
            />
          ),
        }}
      />
      <View className="gap-3 px-4 pt-4 pb-2">
        <TextInput
          className="font-display text-[22px] font-bold text-ink"
          value={name}
          onChangeText={setName}
          onEndEditing={() => void saveName()}
          accessibilityLabel="Nazwa notatki"
          returnKeyType="done"
          maxLength={200}
        />
        <View className="flex-row items-center justify-between gap-3">
          <ChipGroup options={MODES} value={mode} onChange={setMode} />
          <Text
            accessibilityLiveRegion="polite"
            className={
              saveState === "failed"
                ? "font-utility text-[11px] font-semibold tracking-[0.9px] text-danger"
                : "font-utility text-[11px] font-semibold tracking-[0.9px] text-muted"
            }
          >
            {SAVE_LABELS[saveState]}
          </Text>
        </View>
        {error !== "" && <Text className={common.alert}>{error}</Text>}
      </View>
      {mode === "edit" ? (
        <TextInput
          className="mx-4 mb-4 flex-1 rounded border border-control-border bg-input px-[11px] py-2.5 font-utility text-[14px] text-ink align-top"
          value={markdown}
          onChangeText={changeText}
          multiline
          autoFocus={markdown === ""}
          placeholder="Napisz notatkę w Markdown…"
          placeholderTextColorClassName="accent-hint"
          accessibilityLabel="Treść notatki"
          autoCapitalize="sentences"
        />
      ) : (
        <ScrollView contentContainerClassName="px-4 pb-10">
          {markdown.trim() === "" ? (
            <Text className="py-6 text-center text-xs text-muted">
              Notatka jest pusta. Przełącz na Edycję, aby ją napisać.
            </Text>
          ) : (
            <MarkdownView markdown={markdown} highlight={searchQuery} />
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
