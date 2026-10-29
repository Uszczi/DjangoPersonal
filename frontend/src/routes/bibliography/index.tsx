import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BibliographyItemFilters } from "@/components/bibliography/BibliographyItemFilters";
import { BibliographyItemList } from "@/components/bibliography/BibliographyItemList";
import { BibliographyItemEditorModal } from "@/components/modals/BibliographyItemEditorModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import {
  ITEM_KINDS,
  ITEM_STATUSES,
  type ItemKind,
  type ItemStatus,
} from "@personal/shared/bibliographyFormat";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
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

/** The films and books the user tracks, narrowed by status and kind. */
function BibliographyPage() {
  const filters = Route.useSearch();
  const {
    data: items = [],
    isPending,
    isError,
  } = useBibliographyItems(filters);
  const navigate = useNavigate();
  const isFiltered = Boolean(filters.status || filters.kind);

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

      <BibliographyItemFilters filters={filters} onChange={changeFilters} />

      {items.length === 0 ? (
        <EmptyState
          eyebrow="BRAK POZYCJI"
          title={
            isFiltered
              ? "Brak pozycji pasujących do filtrów"
              : "Dodaj pierwszą pozycję"
          }
        />
      ) : (
        <BibliographyItemList items={items} onOpen={openItem} />
      )}
    </>
  );
}
