import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AttemptList } from "@/components/bibliography/AttemptList";
import {
  AttemptEditorModal,
  type AttemptAction,
} from "@/components/modals/AttemptEditorModal";
import { AttemptProgressModal } from "@/components/modals/AttemptProgressModal";
import { BibliographyItemEditorModal } from "@/components/modals/BibliographyItemEditorModal";
import {
  Button,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import {
  attemptProgress,
  ITEM_KIND_LABELS,
  itemByline,
  itemStatusLabel,
} from "@personal/shared/bibliographyFormat";
import type { AttemptResponse } from "@personal/shared/generated/api";
import {
  ATTEMPTS_LOAD_ERROR,
  BIBLIOGRAPHY_ITEMS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useAttempts } from "@personal/shared/queries/bibliographyAttempts";
import { useBibliographyItems } from "@personal/shared/queries/bibliographyItems";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/bibliography/$itemId")({
  component: BibliographyItemPage,
});

/** One film or book: its derived status, the actions its Attempts allow, and their history. */
function BibliographyItemPage() {
  const { itemId } = Route.useParams();
  const id = Number(itemId);
  const navigate = useNavigate();
  const { data: items = [], isPending, isError } = useBibliographyItems();
  const item = items.find((candidate) => candidate.id === id);
  const attemptsQuery = useAttempts(item ? id : null);

  const isMissing = !isPending && !isError && !item;
  useEffect(() => {
    if (isMissing) navigate({ to: "/bibliography" });
  }, [isMissing, navigate]);

  if (isPending) {
    return <LoadingStatus>Wczytywanie pozycji…</LoadingStatus>;
  }
  if (isError) {
    return <ErrorMessage>{BIBLIOGRAPHY_ITEMS_LOAD_ERROR}</ErrorMessage>;
  }
  if (!item) {
    return <LoadingStatus>Przekierowywanie…</LoadingStatus>;
  }

  const attempts = attemptsQuery.data ?? null;
  const open = attempts?.find((attempt) => attempt.outcome === "in_progress");
  const byline = itemByline(item);
  const progress = open
    ? attemptProgress({
        progress: open.progress,
        length: item.length,
        kind: item.kind,
      })
    : "";

  function showAttemptEditor(
    action: AttemptAction,
    attempt: AttemptResponse | null = null,
  ) {
    ShowModal(AttemptEditorModal, { itemId: id, action, attempt });
  }

  return (
    <section aria-label={`Pozycja: ${item.title}`}>
      <PageHeader
        eyebrow={
          <Link
            to="/bibliography"
            className="text-muted no-underline hover:text-ink"
          >
            ← BIBLIOGRAFIA
          </Link>
        }
        title={item.title}
        onTitleClick={() => ShowModal(BibliographyItemEditorModal, { item })}
        titleClickLabel="Edytuj pozycję"
        subtitle={byline || undefined}
        actions={
          <>
            <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              {ITEM_KIND_LABELS[item.kind]}
            </span>
            <span
              aria-label="Status"
              className="rounded-full border border-row-line px-3 py-1 text-[13px] text-ink-soft"
            >
              {itemStatusLabel(item.status, item.kind)}
            </span>
          </>
        }
      />

      {progress && (
        <p aria-label="Postęp" className="mb-3 text-[15px] text-ink-soft">
          {progress}
        </p>
      )}

      {attempts !== null && (
        <div className="mb-6 flex flex-wrap gap-2">
          {open ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  ShowModal(AttemptProgressModal, {
                    attempt: open,
                    kind: item.kind,
                    length: item.length,
                  })
                }
              >
                Postęp
              </Button>
              <Button
                variant="primary"
                onClick={() => showAttemptEditor("finish", open)}
              >
                Zakończ
              </Button>
              <Button
                variant="secondary"
                onClick={() => showAttemptEditor("abandon", open)}
              >
                Porzuć
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={() => showAttemptEditor("start")}
              >
                Zacznij
              </Button>
              <Button
                variant="secondary"
                onClick={() => showAttemptEditor("record")}
              >
                Dodaj ukończone
              </Button>
            </>
          )}
        </div>
      )}

      {attemptsQuery.isError && (
        <ErrorMessage>{ATTEMPTS_LOAD_ERROR}</ErrorMessage>
      )}

      {attempts === null ? (
        !attemptsQuery.isError && (
          <LoadingStatus variant="inline">Wczytywanie podejść…</LoadingStatus>
        )
      ) : (
        <AttemptList
          attempts={attempts}
          kind={item.kind}
          onEdit={(attempt) => showAttemptEditor("edit", attempt)}
        />
      )}
    </section>
  );
}
