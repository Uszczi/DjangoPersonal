import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";

import { useTheme } from "@/theme";
import { KIND_FILTER_LABELS } from "@/features/bibliography/filterLabels";

type SearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  kind: ItemKind | undefined;
  status: ItemStatus | undefined;
  onClearKind: () => void;
  onClearStatus: () => void;
  onOpenFilters: () => void;
};

/** The search box, the Filtry button with its count, and the filters in force as pills. */
export function SearchBar({
  query,
  onQueryChange,
  kind,
  status,
  onClearKind,
  onClearStatus,
  onOpenFilters,
}: SearchBarProps) {
  const { colors } = useTheme();
  const filterCount = (kind ? 1 : 0) + (status ? 1 : 0);
  return (
    <View className="gap-2 px-4 pt-3 pb-1">
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-ink"
          value={query}
          onChangeText={onQueryChange}
          placeholder="Szukaj po tytule, twórcy, roku…"
          placeholderTextColorClassName="accent-hint"
          accessibilityLabel="Szukaj w Bibliografii"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            filterCount > 0 ? `Filtry, aktywne: ${filterCount}` : "Filtry"
          }
          onPress={onOpenFilters}
          className={
            filterCount > 0
              ? "w-[46px] items-center justify-center rounded-[5px] border border-signal bg-signal active:opacity-60"
              : "w-[46px] items-center justify-center rounded-[5px] border border-control-border active:opacity-60"
          }
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={filterCount > 0 ? colors.onSignal : colors.ink}
          />
          {filterCount > 0 && (
            <View className="absolute -top-1.5 -right-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-deep-ink px-1">
              <Text className="text-[10px] font-bold text-nav-text">
                {filterCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      {filterCount > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {kind && (
            <FilterPill
              label={KIND_FILTER_LABELS[kind]}
              onRemove={onClearKind}
            />
          )}
          {status && (
            <FilterPill
              label={itemStatusFilterLabel(status, kind)}
              onRemove={onClearStatus}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** A filter in force under the search box; tapping it removes the filter. */
function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Usuń filtr: ${label}`}
      onPress={onRemove}
      hitSlop={4}
      className="flex-row items-center gap-1 rounded-full bg-wash px-2.5 py-1 active:opacity-60"
    >
      <Text className="text-xs text-ink-soft">{label}</Text>
      <Ionicons name="close" size={13} color={colors.inkSoft} />
    </Pressable>
  );
}
