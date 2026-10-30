import { router } from "expo-router";
import { Pressable, SectionList, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import type { CategoryResponse } from "@personal/shared/generated/api";
import { CATEGORIES_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCategories,
  type CategoryKind,
} from "@personal/shared/queries/categories";

import { NamedIcon } from "../src/NamedIcon";
import { makeStyles, useTheme } from "../src/theme";

type CategorySection = {
  title: string;
  kind: CategoryKind;
  data: CategoryResponse[];
};

/** The categories a transaction can have, grouped by kind; the System category
 * is not managed here. Each section adds a category of its own kind. */
export default function CategoriesScreen() {
  const { colors, common } = useTheme();
  const styles = useStyles();
  const {
    data: categories = [],
    isError,
  } = useCategories();

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
    <View style={common.screen}>
      {isError && <Text style={common.error}>{CATEGORIES_LOAD_ERROR}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(category) => String(category.id)}
        contentContainerStyle={{ paddingBottom: 96 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
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
              <Text style={styles.addLabel}>+ Dodaj</Text>
            </Pressable>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={common.row}
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
            <Text style={[common.rowTitle, { flex: 1 }]}>{item.name}</Text>
            <Text style={common.muted}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 19,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  addLabel: {
    color: colors.signal,
    fontSize: 13,
    fontWeight: "600",
  },
}));
