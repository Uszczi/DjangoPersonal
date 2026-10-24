import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { CounterEntryEditorModal } from "@/components/modals/CounterEntryEditorModal";
import { DeleteCounterModal } from "@/components/modals/DeleteCounterModal";
import { entryCountLabel, formatEntryTime, signedValue } from "@/counterFormat";
import {
  Button,
  ErrorMessage,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import { useCountersStore } from "@/stores/counters";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/$counterId")({
  component: CounterPage,
});

/** One counter: its total, quick +1, and the entries to add, edit and delete. */
function CounterPage() {
  const { counterId } = Route.useParams();
  const id = Number(counterId);
  const navigate = useNavigate();
  const counter = useCountersStore((state) => state.counters.find((item) => item.id === id));
  const isLoading = useCountersStore((state) => state.isLoading);
  const pageError = useCountersStore((state) => state.pageError);
  const entryList = useCountersStore((state) => state.entryList);
  const entriesError = useCountersStore((state) => state.entriesError);
  const loadEntries = useCountersStore((state) => state.loadEntries);
  const saveEntry = useCountersStore((state) => state.saveEntry);

  const exists = counter != null;
  useEffect(() => {
    if (exists) void loadEntries(id);
  }, [exists, id, loadEntries]);

  const isMissing = !isLoading && !pageError && !counter;
  useEffect(() => {
    if (isMissing) navigate({ to: "/counters" });
  }, [isMissing, navigate]);

  if (isLoading) {
    return (
      <LoadingStatus>
        Wczytywanie licznika…
      </LoadingStatus>
    );
  }
  if (pageError) {
    return <ErrorMessage>{pageError}</ErrorMessage>;
  }
  if (!counter) {
    return (
      <LoadingStatus>
        Przekierowywanie…
      </LoadingStatus>
    );
  }

  const entries = entryList?.counterId === id ? entryList.entries : null;

  return (
    <section aria-label={`Licznik: ${counter.name}`}>
      <PageHeader
        eyebrow={
          <Link to="/counters" className="text-muted no-underline hover:text-ink">
            ← LICZNIKI
          </Link>
        }
        title={counter.name}
        onTitleClick={() => ShowModal(CounterEditorModal, { counter })}
        titleClickLabel={`Zmień nazwę licznika: ${counter.name}`}
        subtitle={entryCountLabel(counter.entryCount)}
        actions={
          <p
            className="font-display text-[44px] leading-none font-bold tracking-[-0.03em] text-ink"
            aria-label={`Suma: ${counter.total}`}
          >
            {counter.total}
          </p>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => void saveEntry(id, { value: 1, occurredAt: new Date(), note: "" })}
        >
          +1
        </Button>
        <Button
          variant="secondary"
          onClick={() => ShowModal(CounterEntryEditorModal, { counterId: id })}
        >
          <span aria-hidden="true">+</span>
          Nowy wpis
        </Button>
        <Button
          variant="ghostDanger"
          className="ml-auto"
          onClick={() =>
            ShowModal(DeleteCounterModal, {
              counter,
              onDeleted: () => navigate({ to: "/counters" }),
            })
          }
        >
          Usuń licznik
        </Button>
      </div>

      {entriesError && (
        <ErrorMessage>{entriesError}</ErrorMessage>
      )}

      {entries === null ? (
        !entriesError && (
          <LoadingStatus variant="inline">Wczytywanie wpisów…</LoadingStatus>
        )
      ) : entries.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">Brak wpisów. Dodaj pierwszy wpis.</p>
      ) : (
        <ul className="flex flex-col" aria-label="Wpisy">
          {entries.map((entry) => (
            <ListRow key={entry.id}>
              <ListRowButton
                aria-label={`Edytuj wpis ${signedValue(entry.value)} z ${formatEntryTime(entry.occurredAt)}`}
                onClick={() => ShowModal(CounterEntryEditorModal, { counterId: id, entry })}
              >
                <div className="min-w-0">
                  <ListRowTitle>{formatEntryTime(entry.occurredAt)}</ListRowTitle>
                  {entry.note && <ListRowSubtitle multiline>{entry.note}</ListRowSubtitle>}
                </div>
              </ListRowButton>
              <span
                className={`font-utility text-[14px] font-semibold ${entry.value < 0 ? "text-danger" : "text-ink"}`}
              >
                {signedValue(entry.value)}
              </span>
            </ListRow>
          ))}
        </ul>
      )}
    </section>
  );
}
