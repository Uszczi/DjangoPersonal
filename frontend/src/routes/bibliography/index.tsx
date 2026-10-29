import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { BibliographyItemFilters } from "@/components/bibliography/BibliographyItemFilters";
import { BibliographyItemList } from "@/components/bibliography/BibliographyItemList";
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
  ITEM_KINDS,
  ITEM_STATUSES,
  itemSearchText,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { fuzzyFilter } from "@personal/shared/fuzzy";
import { BIBLIOGRAPHY_ITEMS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useBibliographyItems,
  type BibliographyItemFilters as Filters,
} from "@personal/shared/queries/bibliographyItems";
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
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const isFiltered = Boolean(filters.status || filters.kind);
  const isSearching = query.trim() !== "";
  const shownItems = fuzzyFilter(items, query, itemSearchText);

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

      <div className="relative mb-4 max-w-md">
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

      <BibliographyItemFilters filters={filters} onChange={changeFilters} />

      {shownItems.length === 0 ? (
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
      ) : (
        <BibliographyItemList items={shownItems} onOpen={openItem} />
      )}
    </>
  );
}
