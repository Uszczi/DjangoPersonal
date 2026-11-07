import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import type { TagResponse } from "@personal/shared/generated/api";
import {
  useDeleteTag,
  useTags,
  useUpdateTag,
} from "@personal/shared/queries/tags";

import { TagChip } from "@/features/tasks/TagChip";
import { Button } from "@/ui/Button";
import { ColorPicker } from "@/ui/ColorPicker";
import { common, form } from "@/ui/classes";
import { confirmDestructive } from "@/ui/confirm";

/**
 * Every Tag, like the web's Tag manager: tap one to rename it, recolour it
 * or delete it. New Tags come from the Task editor.
 */
export default function TagsScreen() {
  const { data: tags = [] } = useTags();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ScrollView
      className={common.screen}
      contentContainerClassName={form.content}
      keyboardShouldPersistTaps="handled"
    >
      {tags.length === 0 && (
        <Text className={common.muted}>
          Nie masz jeszcze tagów. Dodasz je w edytorze zadania.
        </Text>
      )}
      {tags.map((tag) =>
        tag.id === editingId ? (
          <TagEditor key={tag.id} tag={tag} onDone={() => setEditingId(null)} />
        ) : (
          <Pressable
            key={tag.id}
            accessibilityRole="button"
            accessibilityLabel={`Edytuj tag: ${tag.name}`}
            onPress={() => setEditingId(tag.id)}
            className="flex-row items-center justify-between border-b border-row-line py-3 active:bg-wash"
          >
            <TagChip tag={tag} />
            <Text className="text-xs text-muted">Edytuj</Text>
          </Pressable>
        ),
      )}
    </ScrollView>
  );
}

function TagEditor({ tag, onDone }: { tag: TagResponse; onDone: () => void }) {
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [error, setError] = useState("");
  const isBusy = updateTag.isPending || deleteTag.isPending;

  async function save() {
    setError("");
    try {
      await updateTag.mutateAsync({ tag, input: { name: name.trim(), color } });
      onDone();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  async function remove() {
    const confirmed = await confirmDestructive(
      "Usunąć tag?",
      `Tag „${tag.name}” zniknie ze wszystkich zadań.`,
      "Usuń tag",
    );
    if (!confirmed) return;
    setError("");
    try {
      await deleteTag.mutateAsync(tag);
      onDone();
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <View className="gap-2 rounded-lg border border-card-line bg-paper p-3">
      <Text className={form.label}>Nazwa tagu</Text>
      <TextInput
        className={form.input}
        value={name}
        maxLength={50}
        onChangeText={setName}
        editable={!isBusy}
      />
      <Text className={form.label}>Kolor</Text>
      <ColorPicker value={color} onChange={setColor} disabled={isBusy} />
      {error !== "" && <Text className={form.error}>{error}</Text>}
      <View className="mt-2 flex-row gap-2">
        <Button
          label="Usuń"
          variant="danger"
          disabled={isBusy}
          onPress={() => void remove()}
        />
        <Button
          label="Anuluj"
          variant="secondary"
          disabled={isBusy}
          onPress={onDone}
        />
        <Button
          label="Zapisz"
          isBusy={updateTag.isPending}
          disabled={isBusy || !name.trim()}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}
