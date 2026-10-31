import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ITEM_KIND_LABELS,
  attemptDates,
  itemByline,
  itemSearchText,
  itemStatusFilterLabel,
  itemStatusLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import { groupByYear, type YearRow } from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { fuzzyFilter } from "@personal/shared/fuzzy";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAllAttempts } from "@personal/shared/queries/bibliographyAttempts";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";

import {
  BibliographyFiltersSheet,
  KIND_FILTER_LABELS,
} from "../../src/BibliographyFiltersSheet";
import { Fab } from "../../src/Fab";
import { fonts, makeStyles, useTheme } from "../../src/theme";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

function openItem(item: BibliographyItemResponse) {
  router.push({ pathname: "/bibliography/[id]", params: { id: item.id } });
}

/** The Bibliography: films and books with their status, narrowed by kind and status and found by a fuzzy search. */
export default function BibliographyScreen() {
  const { colors, common, form } = useTheme();
  const styles = useStyles();
  const [kind, setKind] = useState<ItemKind | undefined>();
  const [status, setStatus] = useState<ItemStatus | undefined>();
  const [query, setQuery] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const {
    data: items = [],
    isPending,
    isError,
    refetch,
  } = useBibliographyItems({ kind, status });
  const viewMode = useBibliographyViewStore((state) => state.mode);
  const dividers = useBibliographyViewStore((state) => state.dividers);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const isYearView = viewMode === "years";
  const attempts = useAllAttempts(isYearView);
  const [isRefreshing, setIsRefreshing] = useState(false);
  useRefreshOnFocus(refetch);

  const filterCount = (kind ? 1 : 0) + (status ? 1 : 0);
  const isFiltered = filterCount > 0;
  const isSearching = query.trim() !== "";
  const shownItems = fuzzyFilter(items, query, itemSearchText);
  const groups =
    isYearView && attempts.data ? groupByYear(shownItems, attempts.data) : [];
  const years = groups.filter((group) => group.key !== "planned");
  const sections: Section[] = !isYearView
    ? // The item view is one section without a header: the list as it always was.
      [
        {
          key: "items",
          data: shownItems.map((item) => ({ item, attempt: null })),
        },
      ]
    : groups.flatMap((group): Section[] => {
        // The planned items fold under a bar like a year's, dividers or not.
        if (group.key === "planned") {
          const planned = {
            key: group.key,
            label: group.label,
            count: group.rows.length,
          };
          return [
            {
              key: group.key,
              year: planned,
              data: folded.has(group.key) ? [] : group.rows,
            },
          ];
        }
        if (!dividers) {
          return [{ key: group.key, data: group.rows }];
        }
        // With dividers, a section per month; the first carries the year bar.
        // A folded year is its bar alone.
        const year = {
          key: group.key,
          label: group.label,
          count: group.rows.length,
        };
        if (folded.has(group.key)) {
          return [{ key: group.key, year, data: [] }];
        }
        return group.months.map((month, index) => ({
          key: month.key,
          year: index === 0 ? year : undefined,
          month: month.label,
          data: month.rows,
        }));
      });
  const isLoading = isPending || (isYearView && attempts.isPending);

  function toggleYear(key: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function refresh() {
    setIsRefreshing(true);
    await Promise.all([refetch(), isYearView ? attempts.refetch() : null]);
    setIsRefreshing(false);
  }

  return (
    <View style={common.screen}>
      {isError && (
        <Text style={common.error}>{BIBLIOGRAPHY_ITEMS_LOAD_ERROR}</Text>
      )}
      {isYearView && attempts.isError && (
        <Text style={common.error}>{ATTEMPTS_LOAD_ERROR}</Text>
      )}
      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <TextInput
            style={[form.input, styles.search]}
            value={query}
            onChangeText={setQuery}
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
            onPress={() => setIsFiltersOpen(true)}
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
        {isFiltered && (
          <View style={styles.pills}>
            {kind && (
              <FilterPill
                label={KIND_FILTER_LABELS[kind]}
                onRemove={() => setKind(undefined)}
              />
            )}
            {status && (
              <FilterPill
                label={itemStatusFilterLabel(status, kind)}
                onRemove={() => setStatus(undefined)}
              />
            )}
          </View>
        )}
      </View>
      <SectionList
        sections={sections}
        keyboardShouldPersistTaps="handled"
        keyExtractor={({ item, attempt }) =>
          attempt ? `a${attempt.id}` : `i${item.id}`
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isLoading}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          !isLoading && !isError ? (
            <Text style={[common.muted, styles.empty]}>
              {isSearching
                ? "Brak pozycji pasujących do wyszukiwania"
                : isFiltered
                  ? "Brak pozycji pasujących do filtrów"
                  : "Brak pozycji. Dodaj pierwszy film lub książkę przyciskiem +."}
            </Text>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <>
            {section.year && (
              <YearBar
                label={section.year.label}
                count={section.year.count}
                isOpen={!folded.has(section.year.key)}
                onPress={() => toggleYear(section.year!.key)}
              />
            )}
            {section.month && <MonthRule label={section.month} />}
          </>
        )}
        renderItem={({ item: { item, attempt } }) => {
          const byline = itemByline(item);
          const dates = attempt ? attemptDates(attempt) : "";
          return (
            <Pressable
              style={common.row}
              accessibilityRole="button"
              accessibilityLabel={`Otwórz pozycję: ${item.title}`}
              onPress={() => openItem(item)}
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
        }}
      />
      <Fab
        accessibilityLabel="Nowa pozycja"
        onPress={() => router.push("/bibliography-item")}
      />
      {isFiltersOpen && (
        <BibliographyFiltersSheet
          kind={kind}
          onKindChange={setKind}
          status={status}
          onStatusChange={setStatus}
          hasYears={years.length > 0}
          onFoldAll={() => setFolded(new Set(groups.map((group) => group.key)))}
          onUnfoldAll={() => setFolded(new Set())}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}
    </View>
  );
}

/**
 * One section of the list: the planned items under their folding bar, or a
 * run of Attempts under a month rule (and, for a year's first month, its
 * folding bar); without dividers, a year's Attempts with no header at all.
 */
type Section = {
  key: string;
  year?: { key: string; label: string; count: number };
  month?: string;
  data: YearRow[];
};

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

/** A year's (or the planned items') header: tapping it folds its rows away or back. */
function YearBar({
  label,
  count,
  isOpen,
  onPress,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${/^\d+$/.test(label) ? `Rok ${label}` : label}, ${count}`}
      accessibilityState={{ expanded: isOpen }}
      onPress={onPress}
      style={({ pressed }) => [styles.yearBar, pressed && styles.pressed]}
    >
      <Text style={styles.yearChevron}>{isOpen ? "▾" : "▸"}</Text>
      <Text style={styles.yearLabel}>{label}</Text>
      <Text style={styles.yearCount}>{count}</Text>
    </Pressable>
  );
}

/** A month inside a year: a thin rule with the month's name in the middle. */
function MonthRule({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.monthRule} accessibilityRole="header">
      <View style={styles.monthLine} />
      <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
      <View style={styles.monthLine} />
    </View>
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
  yearBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: colors.wash,
  },
  yearChevron: { width: 12, fontSize: 14, color: colors.ink },
  yearLabel: { fontSize: 16, fontWeight: "600", color: colors.ink },
  yearCount: { marginLeft: "auto", fontSize: 12, color: colors.muted },
  monthRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  monthLine: { flex: 1, height: 1, backgroundColor: colors.line },
  monthLabel: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.muted,
  },
  listContent: { paddingBottom: 96 },
  empty: { padding: 24, textAlign: "center" },
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
