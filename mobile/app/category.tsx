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
  CATEGORY_ICON_SUGGESTIONS,
  DEFAULT_CATEGORY_ICON,
} from "@personal/shared/categoryIcons";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type CategoryInput,
  type CategoryKind,
} from "@personal/shared/queries/categories";

import { Button } from "../src/Button";
import { confirmDestructive } from "../src/confirm";
import { IconPicker } from "../src/IconPicker";
import { makeStyles, useTheme } from "../src/theme";

/** Creates a Category, or edits one (`?categoryId=`). A new category's kind
 * comes from `?kind=` (its section); an edited one keeps its own kind. */
export default function CategoryEditorScreen() {
  const { common, form } = useTheme();
  const styles = useStyles();
  const params = useLocalSearchParams<{ categoryId?: string; kind?: string }>();
  const categoryId = params.categoryId ? Number(params.categoryId) : null;
  const requestedKind: CategoryKind =
    params.kind === "income" ? "income" : "expense";
  const { data: categories = [] } = useCategories();
  const category =
    categoryId === null
      ? null
      : (categories.find((item) => item.id === categoryId) ?? null);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (categoryId !== null && !category) {
    return (
      <View style={common.center}>
        <Text style={common.muted}>Nie znaleziono kategorii.</Text>
      </View>
    );
  }

  // The kind is fixed at creation, so the editor shows it without changing it.
  const kind: CategoryKind =
    category === null
      ? requestedKind
      : category.kind === "income"
        ? "income"
        : "expense";
  const kindLabel = kind === "income" ? "Przychód" : "Wydatek";

  async function submit() {
    const input: CategoryInput =
      category === null
        ? { name: name.trim(), icon, kind }
        : { name: name.trim(), icon };
    if (!input.name) {
      setFormError("Podaj nazwę kategorii.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (category) {
        await updateCategory.mutateAsync({ category, input });
      } else {
        await createCategory.mutateAsync(input);
      }
      router.back();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!category) return;
    const confirmed = await confirmDestructive(
      "Usunąć kategorię?",
      `Kategoria „${category.name}” zostanie trwale usunięta wraz ze wszystkimi transakcjami, które do niej należą.`,
      "Usuń kategorię",
    );
    if (!confirmed) return;
    setIsSaving(true);
    try {
      // The mutation reloads the transactions and balances that went with it.
      await deleteCategory.mutateAsync(category);
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
        options={{ title: category ? "Edytuj kategorię" : "Nowa kategoria" }}
      />
      <ScrollView
        contentContainerStyle={form.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={form.label}>Rodzaj</Text>
        <Text style={styles.kindValue}>{kindLabel}</Text>

        <Text style={form.label}>Nazwa kategorii</Text>
        <TextInput
          style={form.input}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!category}
          editable={!isSaving}
        />
        <Text style={form.label}>Ikona</Text>
        <IconPicker
          value={icon}
          onChange={(value) => setIcon(value ?? DEFAULT_CATEGORY_ICON)}
          suggestions={CATEGORY_ICON_SUGGESTIONS}
          fallback={DEFAULT_CATEGORY_ICON}
          disabled={isSaving}
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
            label={category ? "Zapisz zmiany" : "Dodaj kategorię"}
            isBusy={isSaving}
            onPress={() => void submit()}
          />
        </View>
        {category && (
          <View style={form.actions}>
            <Button
              label="Usuń kategorię"
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

const useStyles = makeStyles((colors) => ({
  kindValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
}));
