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
  ITEM_KIND_LABELS,
  ITEM_KINDS,
  ITEM_LENGTH_LABELS,
  type ItemKind,
} from "@personal/shared/bibliographyFormat";
import { parseItemNumber } from "@personal/shared/bibliographyForms";
import {
  useBibliographyItem,
  useCreateBibliographyItem,
  useUpdateBibliographyItem,
} from "@personal/shared/queries/bibliographyItems";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { common, form } from "@/ui/classes";

const KIND_OPTIONS = ITEM_KINDS.map((value) => ({
  value,
  label: ITEM_KIND_LABELS[value],
}));

const CREATOR_LABELS: Record<ItemKind, string> = {
  film: "Reżyser",
  book: "Autor",
};

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Adds a BibliographyItem, or edits one (`?itemId=`). Adding asks only for the
 * kind and the title, so a film goes in seconds after the credits; the rest
 * is filled in later by editing.
 */
export default function BibliographyItemEditorScreen() {
  const params = useLocalSearchParams<{ itemId?: string }>();
  const itemId = params.itemId ? Number(params.itemId) : null;
  const item = useBibliographyItem(itemId).data ?? null;
  const createItem = useCreateBibliographyItem();
  const updateItem = useUpdateBibliographyItem();

  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "film");
  const [title, setTitle] = useState(item?.title ?? "");
  const [creator, setCreator] = useState(item?.creator ?? "");
  const [year, setYear] = useState(numberText(item?.year));
  const [length, setLength] = useState(numberText(item?.length));
  const [note, setNote] = useState(item?.note ?? "");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (itemId !== null && !item) {
    return (
      <View className={common.center}>
        <Text className={common.muted}>Nie znaleziono pozycji.</Text>
      </View>
    );
  }

  async function submit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Podaj tytuł.");
      return;
    }
    const yearValue = parseItemNumber(year);
    const lengthValue = parseItemNumber(length);
    if (yearValue === undefined || lengthValue === undefined) {
      setFormError("Rok i długość muszą być dodatnimi liczbami całkowitymi.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (item) {
        await updateItem.mutateAsync({
          id: item.id,
          changes: {
            title: trimmedTitle,
            creator: creator.trim(),
            year: yearValue,
            length: lengthValue,
            note: note.trim(),
          },
        });
        router.back();
      } else {
        const created = await createItem.mutateAsync({
          kind,
          title: trimmedTitle,
        });
        router.replace({
          pathname: "/bibliography/[id]",
          params: { id: created.id },
        });
      }
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ title: item ? "Edytuj pozycję" : "Nowa pozycja" }}
      />
      <ScrollView
        contentContainerClassName={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={form.label}>Rodzaj</Text>
        <ChipGroup
          options={KIND_OPTIONS}
          value={kind}
          onChange={setKind}
          disabled={item !== null || isSaving}
        />
        {item && <Text className={form.hint}>Rodzaju nie można zmienić.</Text>}

        <Text className={form.label}>Tytuł</Text>
        <TextInput
          className={form.input}
          value={title}
          onChangeText={setTitle}
          maxLength={300}
          autoFocus={!item}
          autoCapitalize="sentences"
          returnKeyType={item ? "next" : "done"}
          onSubmitEditing={item ? undefined : () => void submit()}
          editable={!isSaving}
        />

        {item && (
          <>
            <Text className={form.label}>{CREATOR_LABELS[kind]}</Text>
            <TextInput
              className={form.input}
              value={creator}
              onChangeText={setCreator}
              maxLength={200}
              autoCapitalize="words"
              editable={!isSaving}
            />

            <Text className={form.label}>Rok</Text>
            <TextInput
              className={form.input}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              editable={!isSaving}
            />

            <Text className={form.label}>{ITEM_LENGTH_LABELS[kind]}</Text>
            <TextInput
              className={form.input}
              value={length}
              onChangeText={setLength}
              keyboardType="number-pad"
              editable={!isSaving}
            />

            <Text className={form.label}>Notatka</Text>
            <TextInput
              className={form.multiline}
              value={note}
              onChangeText={setNote}
              maxLength={10000}
              multiline
              editable={!isSaving}
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
            label={item ? "Zapisz zmiany" : "Dodaj pozycję"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
