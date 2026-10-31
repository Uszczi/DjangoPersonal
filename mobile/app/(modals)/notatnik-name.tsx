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
  useCreateFolder,
  useFolders,
  useRenameFolder,
} from "@personal/shared/queries/folders";
import {
  useRenameWhiteboard,
  useWhiteboards,
} from "@personal/shared/queries/whiteboards";

import { Button } from "@/ui/Button";
import { common, form } from "@/ui/classes";

/**
 * Names a Notatnik thing: a new Folder (`?target=folder`, inside
 * `?parentId=`), or an existing Folder or item (`?target=folder|item&id=`).
 */
export default function NotatnikNameScreen() {
  const params = useLocalSearchParams<{
    target: "folder" | "item";
    id?: string;
    parentId?: string;
  }>();
  const isFolder = params.target === "folder";
  const id = params.id ? Number(params.id) : null;
  const parentId = params.parentId ? Number(params.parentId) : null;
  const { data: folders = [] } = useFolders();
  const { data: items = [] } = useWhiteboards();
  const existing =
    id === null
      ? null
      : isFolder
        ? folders.find((folder) => folder.id === id)
        : items.find((item) => item.id === id);
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const renameItem = useRenameWhiteboard();

  const [name, setName] = useState(existing?.name ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Podaj nazwę.");
      return;
    }
    if (isFolder && /[\s/]/.test(trimmed)) {
      setFormError("Nazwa folderu nie może zawierać spacji ani „/”.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (id === null) {
        await createFolder.mutateAsync({ name: trimmed, parentId });
      } else if (isFolder) {
        await renameFolder.mutateAsync({ id, name: trimmed });
      } else {
        await renameItem.mutateAsync({ id, name: trimmed });
      }
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  const title =
    id === null
      ? "Nowy folder"
      : isFolder
        ? "Zmień nazwę folderu"
        : "Zmień nazwę";

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title }} />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Nazwa</Text>
        <TextInput
          className={form.input}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize={isFolder ? "none" : "sentences"}
          autoCorrect={!isFolder}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          editable={!isSaving}
        />
        {isFolder && <Text className={form.hint}>Bez spacji i bez „/”.</Text>}
        {formError !== "" && <Text className={form.error}>{formError}</Text>}
        <View className={form.actions}>
          <Button
            label="Anuluj"
            variant="secondary"
            disabled={isSaving}
            onPress={() => router.back()}
          />
          <Button
            label={id === null ? "Utwórz folder" : "Zapisz"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
