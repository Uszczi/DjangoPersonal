import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import {
  ITEM_KIND_LABELS,
  attemptDates,
  itemByline,
  itemStatusLabel,
} from "@personal/shared/bibliographyFormat";
import type { YearRow } from "@personal/shared/bibliographyYears";

import { common } from "../../ui/classes";

/** One list row: an item, or in the year view one of its Attempts; a tap opens the item. */
export function ItemRow({ row: { item, attempt } }: { row: YearRow }) {
  const byline = itemByline(item);
  const dates = attempt ? attemptDates(attempt) : "";
  return (
    <Pressable
      className={common.row}
      accessibilityRole="button"
      accessibilityLabel={`Otwórz pozycję: ${item.title}`}
      onPress={() =>
        router.push({ pathname: "/bibliography/[id]", params: { id: item.id } })
      }
    >
      <View className="flex-1">
        <Text className={common.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text className={common.rowSubtitle} numberOfLines={1}>
          {[ITEM_KIND_LABELS[item.kind], byline, dates]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      {/* The web's status pill. */}
      <Text className="rounded-full border border-row-line px-2.5 py-1 text-xs text-ink-soft">
        {itemStatusLabel(attempt?.outcome ?? item.status, item.kind)}
      </Text>
    </Pressable>
  );
}
