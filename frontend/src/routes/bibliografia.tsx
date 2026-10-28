import { createFileRoute } from "@tanstack/react-router";

import { PozycjaList } from "@/components/bibliografia/PozycjaList";
import { PozycjaEditorModal } from "@/components/modals/PozycjaEditorModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import type { PozycjaResponse } from "@personal/shared/generated/api";
import { POZYCJE_LOAD_ERROR } from "@personal/shared/loadErrors";
import { usePozycje } from "@personal/shared/queries/pozycje";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/bibliografia")({
  component: BibliografiaPage,
});

/** The films and books the user tracks. */
function BibliografiaPage() {
  const { data: pozycje = [], isPending, isError } = usePozycje();

  function showCreate() {
    ShowModal(PozycjaEditorModal, {});
  }

  function showEdit(pozycja: PozycjaResponse) {
    ShowModal(PozycjaEditorModal, { pozycja });
  }

  if (isPending) {
    return <LoadingStatus>Wczytywanie Bibliografii…</LoadingStatus>;
  }

  if (isError) {
    return <ErrorMessage>{POZYCJE_LOAD_ERROR}</ErrorMessage>;
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

      {pozycje.length === 0 ? (
        <EmptyState eyebrow="BRAK POZYCJI" title="Dodaj pierwszą pozycję" />
      ) : (
        <PozycjaList pozycje={pozycje} onEdit={showEdit} />
      )}
    </>
  );
}
