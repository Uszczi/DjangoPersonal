import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { ResponseError } from "@personal/shared/generated/api";
import { NOTE_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useWhiteboard } from "@personal/shared/queries/whiteboards";

import { common } from "@/ui/classes";
import { NoteEditor } from "@/features/notes/NoteEditor";

/** One Notatka (`?q=`: a Notatnik search to mark in it). */
export default function NoteScreen() {
  const { id: rawId, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const id = Number(rawId);
  const note = useWhiteboard(id);

  if (note.isPending) {
    return (
      <View className={common.center}>
        <ActivityIndicator colorClassName="accent-muted" />
      </View>
    );
  }
  if (note.isError) {
    const isMissing =
      note.error instanceof ResponseError && note.error.response.status === 404;
    return (
      <View className={common.center}>
        <Text className={common.muted}>
          {isMissing ? "Nie znaleziono notatki." : NOTE_LOAD_ERROR}
        </Text>
      </View>
    );
  }
  if (note.data.kind !== "markdown") {
    return (
      <View className={common.center}>
        <Text className="text-center text-xs text-muted">
          To tablica: otworzysz ją w przeglądarce, na komputerze.
        </Text>
      </View>
    );
  }
  // Keyed, so another Notatka starts with its own text and autosave.
  return <NoteEditor key={id} note={note.data} searchQuery={q} />;
}
