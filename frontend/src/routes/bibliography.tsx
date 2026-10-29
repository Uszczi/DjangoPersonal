import { createFileRoute } from "@tanstack/react-router";

import { BibliographyItemList } from "@/components/bibliography/BibliographyItemList";
import { BibliographyItemEditorModal } from "@/components/modals/BibliographyItemEditorModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { BIBLIOGRAPHY_ITEMS_LOAD_ERROR } from "@personal/shared/loadErrors";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/bibliography")({
  component: BibliographyPage,
});

/** The films and books the user tracks. */
function BibliographyPage() {
  const { data: items = [], isPending, isError } = useBibliographyItems();

  function showCreate() {
    ShowModal(BibliographyItemEditorModal, {});
  }

  function showEdit(item: BibliographyItemResponse) {
    ShowModal(BibliographyItemEditorModal, { item });
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

      {items.length === 0 ? (
        <EmptyState eyebrow="BRAK POZYCJI" title="Dodaj pierwszą pozycję" />
      ) : (
        <BibliographyItemList items={items} onEdit={showEdit} />
      )}
    </>
  );
}
