import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import {
  ITEM_KIND_LABELS,
  attemptDates,
  itemByline,
  itemStatusLabel,
} from "@personal/shared/bibliographyFormat";
import type { YearRow } from "@personal/shared/bibliographyYears";

import { makeStyles, useTheme } from "../../theme";

/** One list row: an item, or in the year view one of its Attempts; a tap opens the item. */
export function ItemRow({ row: { item, attempt } }: { row: YearRow }) {
  const { common } = useTheme();
  const styles = useStyles();
  const byline = itemByline(item);
  const dates = attempt ? attemptDates(attempt) : "";
  return (
    <Pressable
      style={common.row}
      accessibilityRole="button"
      accessibilityLabel={`Otwórz pozycję: ${item.title}`}
      onPress={() =>
        router.push({ pathname: "/bibliography/[id]", params: { id: item.id } })
      }
    >
      <View style={{ flex: 1 }}>
        <Text style={common.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={common.rowSubtitle} numberOfLines={1}>
          {[ITEM_KIND_LABELS[item.kind], byline, dates]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Text style={styles.status}>
        {itemStatusLabel(attempt?.outcome ?? item.status, item.kind)}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  // The web's status pill.
  status: {
    borderWidth: 1,
    borderColor: colors.rowLine,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    color: colors.inkSoft,
  },
}));
