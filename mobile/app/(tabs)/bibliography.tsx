import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ITEM_KIND_LABELS,
  ITEM_STATUSES,
  attemptDates,
  itemByline,
  itemSearchText,
  itemStatusFilterLabel,
  itemStatusLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import {
  groupByYear,
  type YearGroup,
} from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { fuzzyFilter } from "@personal/shared/fuzzy";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAllAttempts } from "@personal/shared/queries/bibliographyAttempts";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";
import {
  useBibliographyViewStore,
  type BibliographyViewMode,
} from "@personal/shared/stores/bibliographyView";

import { ChipGroup } from "../../src/ChipGroup";
import { Fab } from "../../src/Fab";
import { fonts, makeStyles, useTheme } from "../../src/theme";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

/** A chip value for "no filter": ChipGroup needs a value for every option. */
const ALL = "all";

const KIND_FILTERS: { value: ItemKind | typeof ALL; label: string }[] = [
  { value: ALL, label: "Wszystkie" },
  { value: "film", label: "Filmy" },
  { value: "book", label: "Książki" },
];

const VIEW_MODES: { value: BibliographyViewMode; label: string }[] = [
  { value: "items", label: "Pozycje" },
  { value: "years", label: "Lata" },
];

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
  const {
    data: items = [],
    isPending,
    isError,
    refetch,
  } = useBibliographyItems({ kind, status });
  const viewMode = useBibliographyViewStore((state) => state.mode);
  const setViewMode = useBibliographyViewStore((state) => state.setMode);
  const isYearView = viewMode === "years";
  const attempts = useAllAttempts(isYearView);
  const [isRefreshing, setIsRefreshing] = useState(false);
  useRefreshOnFocus(refetch);

  const statusFilters: { value: ItemStatus | typeof ALL; label: string }[] = [
    { value: ALL, label: "Wszystkie" },
    ...ITEM_STATUSES.map((value) => ({
      value,
      label: itemStatusFilterLabel(value, kind),
    })),
  ];
  const isFiltered = kind !== undefined || status !== undefined;
  const isSearching = query.trim() !== "";
  const shownItems = fuzzyFilter(items, query, itemSearchText);
  // The item view is one section without a header: the list as it always was.
  const groups: YearGroup[] = isYearView
    ? attempts.data
      ? groupByYear(shownItems, attempts.data)
      : []
    : [
        {
          key: "items",
          label: "",
          rows: shownItems.map((item) => ({ item, attempt: null })),
        },
      ];
  const sections = groups
    .filter((group) => group.rows.length > 0)
    .map((group) => ({ ...group, data: group.rows }));
  const isLoading = isPending || (isYearView && attempts.isPending);

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
        <ChipGroup
          options={VIEW_MODES}
          value={viewMode}
          onChange={setViewMode}
        />
        <TextInput
          style={form.input}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filtr rodzaju"
        >
          <ChipGroup
            nowrap
            options={KIND_FILTERS}
            value={kind ?? ALL}
            onChange={(value) => setKind(value === ALL ? undefined : value)}
          />
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filtr statusu"
        >
          <ChipGroup
            nowrap
            options={statusFilters}
            value={status ?? ALL}
            onChange={(value) => setStatus(value === ALL ? undefined : value)}
          />
        </ScrollView>
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
        renderSectionHeader={({ section }) =>
          section.label ? (
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {section.label}
            </Text>
          ) : null
        }
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
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  filters: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  listContent: { paddingBottom: 96 },
  // The expenses' day headers.
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
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
