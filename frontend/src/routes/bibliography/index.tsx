import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { BibliographyItemList } from "@/components/bibliography/BibliographyItemList";
import { BibliographyYearList } from "@/components/bibliography/BibliographyYearList";
import { BibliographyFiltersModal } from "@/components/modals/BibliographyFiltersModal";
import { BibliographyItemEditorModal } from "@/components/modals/BibliographyItemEditorModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
  TextInput,
} from "@/design-system";
import {
  ITEM_KIND_FILTER_LABELS,
  ITEM_KINDS,
  ITEM_STATUSES,
  itemSearchText,
  itemStatusFilterLabel,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import { groupByYear } from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { fuzzyFilter } from "@personal/shared/fuzzy";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAllAttempts } from "@personal/shared/queries/bibliographyAttempts";
import {
  useBibliographyItems,
  type BibliographyItemFilters as Filters,
} from "@personal/shared/queries/bibliographyItems";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";
import { ShowModal } from "@/stores/modal";

/** The list's filters live in the address (`?status=planned&kind=film`), so a narrowed list can be linked to. */
function validateFilters(search: Record<string, unknown>): Filters {
  const status = ITEM_STATUSES.find((option) => option === search.status);
  const kind = ITEM_KINDS.find((option) => option === search.kind);
  return { status, kind } satisfies {
    status?: ItemStatus;
    kind?: ItemKind;
  };
}

export const Route = createFileRoute("/bibliography/")({
  validateSearch: validateFilters,
  component: BibliographyPage,
});

/** The films and books the user tracks, narrowed by status and kind and found by a fuzzy search. */
function BibliographyPage() {
  const filters = Route.useSearch();
  const {
    data: items = [],
    isPending,
    isError,
  } = useBibliographyItems(filters);
  const viewMode = useBibliographyViewStore((state) => state.mode);
  const isYearView = viewMode === "years";
  const attempts = useAllAttempts(isYearView);
  const [query, setQuery] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  // Folded years are not remembered, so they live here, not in a store.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const navigate = useNavigate();
  const isFiltered = Boolean(filters.status || filters.kind);
  const isSearching = query.trim() !== "";
  const shownItems = fuzzyFilter(items, query, itemSearchText);
  const filterCount = (filters.status ? 1 : 0) + (filters.kind ? 1 : 0);
  const yearGroups =
    isYearView && attempts.data ? groupByYear(shownItems, attempts.data) : [];

  function toggleFolded(key: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function changeFilters(next: Filters) {
    navigate({ to: "/bibliography", search: next, replace: true });
  }

  function showCreate() {
    ShowModal(BibliographyItemEditorModal, {});
  }

  function openItem(item: BibliographyItemResponse) {
    navigate({
      to: "/bibliography/$itemId",
      params: { itemId: String(item.id) },
    });
  }

  if (isPending) {
    return <LoadingStatus>Wczytywanie Bibliografii…</LoadingStatus>;
  }

  if (isError) {
    return <ErrorMessage>{BIBLIOGRAPHY_ITEMS_LOAD_ERROR}</ErrorMessage>;
  }

  return (
    <>
      <PageHeader
        title="Bibliografia"
        actions={
          <Button variant="primary" onClick={showCreate}>
            <span aria-hidden="true">+</span>
            Nowa pozycja
          </Button>
        }
      />

      <div className="mb-4 flex max-w-xl flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted"
            />
            <TextInput
              type="search"
              aria-label="Szukaj w Bibliografii"
              placeholder="Szukaj po tytule, twórcy, roku…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
            />
          </div>
          <Button
            variant={filterCount > 0 ? "primary" : "secondary"}
            aria-label={
              filterCount > 0 ? `Filtry, aktywne: ${filterCount}` : "Filtry"
            }
            onClick={() => setIsFiltersOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-[15px]" />
            Filtry
            {filterCount > 0 && (
              <span
                aria-hidden="true"
                className="rounded-full bg-deep-ink px-1.5 text-[11px] font-bold text-nav-text"
              >
                {filterCount}
              </span>
            )}
          </Button>
        </div>
        {filterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.kind && (
              <FilterPill
                label={ITEM_KIND_FILTER_LABELS[filters.kind]}
                onRemove={() => changeFilters({ ...filters, kind: undefined })}
              />
            )}
            {filters.status && (
              <FilterPill
                label={itemStatusFilterLabel(filters.status, filters.kind)}
                onRemove={() =>
                  changeFilters({ ...filters, status: undefined })
                }
              />
            )}
          </div>
        )}
      </div>

      {isYearView && attempts.isPending ? (
        <LoadingStatus>Wczytywanie podejść…</LoadingStatus>
      ) : isYearView && attempts.isError ? (
        <ErrorMessage>{ATTEMPTS_LOAD_ERROR}</ErrorMessage>
      ) : shownItems.length === 0 ? (
        <EmptyState
          eyebrow="BRAK POZYCJI"
          title={
            isSearching
              ? "Brak pozycji pasujących do wyszukiwania"
              : isFiltered
                ? "Brak pozycji pasujących do filtrów"
                : "Dodaj pierwszą pozycję"
          }
        />
      ) : isYearView ? (
        <BibliographyYearList
          groups={yearGroups}
          folded={folded}
          onToggleFolded={toggleFolded}
          onOpen={openItem}
        />
      ) : (
        <BibliographyItemList items={shownItems} onOpen={openItem} />
      )}

      {isFiltersOpen && (
        <BibliographyFiltersModal
          filters={filters}
          onChange={changeFilters}
          onFoldAll={() =>
            setFolded(new Set(yearGroups.map((group) => group.key)))
          }
          onUnfoldAll={() => setFolded(new Set())}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}
    </>
  );
}

/** A filter in force under the search box; clicking it removes the filter. */
function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Usuń filtr: ${label}`}
      onClick={onRemove}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-wash px-2.5 py-1 font-inherit text-[12px] text-ink-soft hover:bg-icon-wash focus-visible:outline-2 focus-visible:outline-accent"
    >
      {label}
      <X aria-hidden="true" className="size-[13px]" />
    </button>
  );
}
