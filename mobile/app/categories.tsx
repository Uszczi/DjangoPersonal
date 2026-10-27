import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import { CATEGORIES_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useCategories } from "@personal/shared/queries/categories";

import { Fab } from "../src/Fab";
import { NamedIcon } from "../src/NamedIcon";
import { colors, common } from "../src/theme";

/** The categories a transaction can have; the System category is not managed here. */
export default function CategoriesScreen() {
  const {
    data: categories = [],
    isPending: isLoading,
    isError,
  } = useCategories();

  const visible = categories.filter((category) => !category.isSystem);

  return (
    <View style={common.screen}>
      {isError && <Text style={common.error}>{CATEGORIES_LOAD_ERROR}</Text>}
      <FlatList
        data={visible}
        keyExtractor={(category) => String(category.id)}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[common.muted, { padding: 24, textAlign: "center" }]}>
              Brak kategorii.
            </Text>
          ) : undefined
        }
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
              color={colors.text}
            />
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>
              {item.name}
            </Text>
            <Text style={common.muted}>›</Text>
          </Pressable>
        )}
      />
      <Fab
        accessibilityLabel="Nowa kategoria"
        onPress={() => router.push("/category")}
      />
    </View>
  );
}
