import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, SectionList, Text, View } from "react-native";

import {
  itemSearchText,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import { groupByYear } from "@personal/shared/bibliographyYears";
import { fuzzyFilter } from "@personal/shared/fuzzy";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAllAttempts } from "@personal/shared/queries/bibliographyAttempts";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";

import { BibliographyFiltersSheet } from "../../src/features/bibliography/BibliographyFiltersSheet";
import { ItemRow } from "../../src/features/bibliography/ItemRow";
import {
  itemSections,
  yearSections,
} from "../../src/features/bibliography/listSections";
import { SearchBar } from "../../src/features/bibliography/SearchBar";
import {
  MonthRule,
  YearBar,
} from "../../src/features/bibliography/SectionHeaders";
import { common } from "../../src/ui/classes";
import { Fab } from "../../src/ui/Fab";
import { useRefreshOnFocus } from "../../src/useRefreshOnFocus";

/** The Bibliography: films and books with their status, narrowed by kind and status and found by a fuzzy search. */
export default function BibliographyScreen() {
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

  const isFiltered = kind !== undefined || status !== undefined;
  const isSearching = query.trim() !== "";
  const shownItems = fuzzyFilter(items, query, itemSearchText);
  const groups =
    isYearView && attempts.data ? groupByYear(shownItems, attempts.data) : [];
  const years = groups.filter((group) => group.key !== "planned");
  const sections = isYearView
    ? yearSections(groups, dividers, folded)
    : itemSections(shownItems);
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
    <View className={common.screen}>
      {isError && (
        <Text className={common.error}>{BIBLIOGRAPHY_ITEMS_LOAD_ERROR}</Text>
      )}
      {isYearView && attempts.isError && (
        <Text className={common.error}>{ATTEMPTS_LOAD_ERROR}</Text>
      )}
      <SearchBar
        query={query}
        onQueryChange={setQuery}
        kind={kind}
        status={status}
        onClearKind={() => setKind(undefined)}
        onClearStatus={() => setStatus(undefined)}
        onOpenFilters={() => setIsFiltersOpen(true)}
      />
      <SectionList
        sections={sections}
        keyboardShouldPersistTaps="handled"
        keyExtractor={({ item, attempt }) =>
          attempt ? `a${attempt.id}` : `i${item.id}`
        }
        contentContainerClassName="pb-24"
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isLoading}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          !isLoading && !isError ? (
            <Text className="p-6 text-center text-xs text-muted">
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
        renderItem={({ item }) => <ItemRow row={item} />}
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
