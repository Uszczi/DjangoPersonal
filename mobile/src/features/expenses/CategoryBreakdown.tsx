import { Pressable, Text, View } from "react-native";

import { DEFAULT_CATEGORY_ICON } from "@personal/shared/categoryIcons";
import { formatCents, type MonthSummary } from "@personal/shared/expenseMonth";
import type { CategoryResponse } from "@personal/shared/generated/api";

import { useTheme } from "@/theme";
import { card } from "@/ui/classes";
import { NamedIcon } from "@/ui/NamedIcon";

type CategoryBreakdownProps = {
  summary: MonthSummary;
  categories: CategoryResponse[];
  /** The Category the list is narrowed to (`null` for uncategorised), if any. */
  selected: number | null | undefined;
  onSelect: (categoryId: number | null | undefined) => void;
};

/** "Na co poszło", like the web: the month's Expenses by Category as bars; a tap narrows the list. */
export function CategoryBreakdown({
  summary,
  categories,
  selected,
  onSelect,
}: CategoryBreakdownProps) {
  const { colors } = useTheme();
  const largest = summary.byCategory[0]?.cents ?? 1;

  return (
    <View className={card.section}>
      <Text className="font-display text-[17px] font-bold text-ink">
        Na co poszło
      </Text>
      {summary.byCategory.length === 0 && (
        <Text className="text-xs text-muted">
          Brak wydatków w tym miesiącu.
        </Text>
      )}
      {summary.byCategory.map((total) => {
        const category = categories.find(
          (item) => item.id === total.categoryId,
        );
        const name = category?.name ?? "Bez kategorii";
        const active = selected === total.categoryId;
        return (
          <Pressable
            key={total.categoryId ?? "none"}
            accessibilityRole="button"
            accessibilityLabel={`${name}: ${formatCents(total.cents)} zł`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? undefined : total.categoryId)}
            className={
              active
                ? "gap-1.5 rounded-md border border-accent bg-wash px-2 py-2"
                : "gap-1.5 rounded-md border border-transparent px-2 py-2 active:bg-wash"
            }
          >
            <View className="flex-row items-center gap-2">
              {category && (
                <NamedIcon
                  name={category.icon}
                  fallback={DEFAULT_CATEGORY_ICON}
                  size={15}
                  color={colors.icon}
                />
              )}
              <Text className="flex-1 text-sm text-ink">{name}</Text>
              <Text className="text-[11px] text-muted">{total.count}×</Text>
              <Text className="font-utility text-[13px] font-semibold text-ink tabular-nums">
                {formatCents(total.cents)}
              </Text>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-line-soft">
              <View
                className="h-full rounded-full bg-signal"
                style={{ width: `${(total.cents / largest) * 100}%` }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
