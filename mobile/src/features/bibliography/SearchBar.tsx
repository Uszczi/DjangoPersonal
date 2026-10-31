import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";

import { makeStyles, useTheme } from "../../theme";
import { KIND_FILTER_LABELS } from "./filterLabels";

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
  const { colors, form } = useTheme();
  const styles = useStyles();
  const filterCount = (kind ? 1 : 0) + (status ? 1 : 0);
  return (
    <View style={styles.filters}>
      <View style={styles.searchRow}>
        <TextInput
          style={[form.input, styles.search]}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Szukaj po tytule, twórcy, roku…"
          placeholderTextColor={colors.hint}
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
          style={({ pressed }) => [
            styles.filtersButton,
            filterCount > 0 && styles.filtersButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={filterCount > 0 ? colors.onSignal : colors.ink}
          />
          {filterCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
      {filterCount > 0 && (
        <View style={styles.pills}>
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
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Usuń filtr: ${label}`}
      onPress={onRemove}
      hitSlop={4}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Text style={styles.pillText}>{label}</Text>
      <Ionicons name="close" size={13} color={colors.inkSoft} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  filters: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  search: { flex: 1 },
  filtersButton: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 5,
  },
  filtersButtonActive: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.deepInk,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: colors.navText },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.wash,
  },
  pillText: { fontSize: 12, color: colors.inkSoft },
  pressed: { opacity: 0.6 },
}));
