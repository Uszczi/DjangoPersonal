import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  findTagByName,
  nextTagColor,
  useCreateTag,
  useTags,
} from "@personal/shared/queries/tags";

import { TagDot } from "@/features/tasks/TagChip";
import { Button } from "@/ui/Button";
import { form } from "@/ui/classes";

type TagPickerProps = {
  /** The ids of the chosen Tags. */
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
};

/**
 * The Task editor's Tags, like the web: every Tag as a toggle, and a field
 * that picks the Tag it names or creates it.
 */
export function TagPicker({
  value,
  onChange,
  disabled = false,
}: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const chosen = new Set(value);

  function toggle(tagId: string) {
    onChange(
      chosen.has(tagId)
        ? value.filter((id) => id !== tagId)
        : [...value, tagId],
    );
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    const existing = findTagByName(tags, trimmed);
    if (existing) {
      if (!chosen.has(existing.id)) onChange([...value, existing.id]);
      setName("");
      return;
    }
    try {
      const created = await createTag.mutateAsync({
        name: trimmed,
        color: nextTagColor(tags),
      });
      onChange([...value, created.id]);
      setName("");
    } catch (caught) {
      setError(await apiErrorMessage(caught));
    }
  }

  return (
    <>
      <Text className={form.label}>Tagi</Text>
      {tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {tags.map((tag) => {
            const isChosen = chosen.has(tag.id);
            return (
              <Pressable
                key={tag.id}
                accessibilityRole="checkbox"
                accessibilityLabel={tag.name}
                accessibilityState={{ checked: isChosen, disabled }}
                disabled={disabled}
                onPress={() => toggle(tag.id)}
                className={
                  isChosen
                    ? "flex-row items-center gap-1.5 rounded-full border border-ink bg-paper px-3 py-1.5"
                    : "flex-row items-center gap-1.5 rounded-full border border-control-border px-3 py-1.5 active:bg-wash"
                }
              >
                <TagDot color={tag.color} />
                <Text
                  className={
                    isChosen
                      ? "text-[13px] font-semibold text-ink"
                      : "text-[13px] text-ink-soft"
                  }
                >
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <TextInput
          className={`flex-1 ${form.input}`}
          accessibilityLabel="Nowy tag"
          placeholder="Dodaj tag…"
          placeholderTextColorClassName="accent-hint"
          maxLength={50}
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void add()}
          submitBehavior="submit"
          returnKeyType="done"
          editable={!disabled}
        />
        <Button
          label="Dodaj"
          variant="secondary"
          className="flex-none"
          disabled={disabled || !name.trim()}
          isBusy={createTag.isPending}
          onPress={() => void add()}
        />
      </View>
      {error !== "" && <Text className={form.error}>{error}</Text>}
    </>
  );
}
