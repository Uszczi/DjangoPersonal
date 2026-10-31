import { router } from "expo-router";
import { Pressable, SectionList, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import type { CategoryResponse } from "@personal/shared/generated/api";
import { CATEGORIES_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCategories,
  type CategoryKind,
} from "@personal/shared/queries/categories";

import { NamedIcon } from "../src/ui/NamedIcon";
import { useTheme } from "../src/theme";
import { common } from "../src/ui/classes";

type CategorySection = {
  title: string;
  kind: CategoryKind;
  data: CategoryResponse[];
};

/** The categories a transaction can have, grouped by kind; the System category
 * is not managed here. Each section adds a category of its own kind. */
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const { data: categories = [], isError } = useCategories();

  const visible = categories.filter((category) => !category.isSystem);
  const sections: CategorySection[] = [
    {
      title: "Wydatki",
      kind: "expense",
      data: visible.filter((category) => category.kind === "expense"),
    },
    {
      title: "Przychody",
      kind: "income",
      data: visible.filter((category) => category.kind === "income"),
    },
  ];

  return (
    <View className={common.screen}>
      {isError && <Text className={common.error}>{CATEGORIES_LOAD_ERROR}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(category) => String(category.id)}
        contentContainerClassName="pb-24"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center justify-between px-[19px] pt-5 pb-1">
            <Text className="text-[16px] font-bold text-ink">
              {section.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Nowa kategoria ${
                section.kind === "income" ? "przychodu" : "wydatku"
              }`}
              onPress={() =>
                router.push({
                  pathname: "/category",
                  params: { kind: section.kind },
                })
              }
            >
              <Text className="text-[13px] font-semibold text-signal">
                + Dodaj
              </Text>
            </Pressable>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            className={common.row}
            accessibilityRole="button"
            accessibilityLabel={`Edytuj kategorię: ${item.name}`}
            onPress={() =>
              router.push({
                pathname: "/category",
                params: { categoryId: item.id },
              })
            }
          >
            <NamedIcon
              name={item.icon}
              fallback={DEFAULT_CATEGORY_ICON}
              color={colors.icon}
            />
            <Text className="flex-1 text-sm font-medium text-ink">
              {item.name}
            </Text>
            <Text className={common.muted}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
