import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { useEffect } from "react";

import { ColorDot } from "@/components/ColorDot";
import { CounterCalendar } from "@/components/counters/CounterCalendar";
import { CounterEntryList } from "@/components/counters/CounterEntryList";
import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { CounterEntryEditorModal } from "@/components/modals/CounterEntryEditorModal";
import { DeleteCounterModal } from "@/components/modals/DeleteCounterModal";
import { entryCountLabel } from "@personal/shared/counterFormat";
import {
  Button,
  ErrorMessage,
  IconButton,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import {
  COUNTER_ENTRIES_LOAD_ERROR,
  COUNTERS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import {
  useCounterEntries,
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/$counterId")({
  component: CounterPage,
});

/** One counter: its total, quick +1, a calendar of the days its entries fall on, and the entries to add, edit and delete. */
function CounterPage() {
  const { counterId } = Route.useParams();
  const id = Number(counterId);
  const navigate = useNavigate();
  const {
    data: counters = [],
    isPending: isLoading,
    isError: isCountersError,
  } = useCounters();
  const counter = counters.find((item) => item.id === id);
  const entriesQuery = useCounterEntries(counter ? id : null);
  const saveEntry = useSaveCounterEntry();

  const isMissing = !isLoading && !isCountersError && !counter;
  useEffect(() => {
    if (isMissing) navigate({ to: "/counters" });
  }, [isMissing, navigate]);

  if (isLoading) {
    return <LoadingStatus>Wczytywanie licznika…</LoadingStatus>;
  }
  if (isCountersError) {
    return <ErrorMessage>{COUNTERS_LOAD_ERROR}</ErrorMessage>;
  }
  if (!counter) {
    return <LoadingStatus>Przekierowywanie…</LoadingStatus>;
  }

  const entries = entriesQuery.data ?? null;
  const entriesError = entriesQuery.isError ? COUNTER_ENTRIES_LOAD_ERROR : "";

  return (
    <section aria-label={`Licznik: ${counter.name}`}>
      <PageHeader
        eyebrow={
          <Link
            to="/counters"
            className="text-muted no-underline hover:text-ink"
          >
            ← LICZNIKI
          </Link>
        }
        title={counter.name}
        onTitleClick={() => ShowModal(CounterEditorModal, { counter })}
        titleClickLabel={`Edytuj licznik: ${counter.name}`}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <ColorDot color={counter.color} />
            {entryCountLabel(counter.entryCount)}
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <IconButton
              aria-label={`Zmień kolor licznika: ${counter.name}`}
              title="Zmień kolor"
              onClick={() => ShowModal(CounterEditorModal, { counter })}
              style={{ color: counter.color }}
            >
              <Palette aria-hidden="true" className="size-[22px]" />
            </IconButton>
            <p
              className="font-display text-[44px] leading-none font-bold tracking-[-0.03em] text-ink"
              aria-label={`Suma: ${counter.total}`}
            >
              {counter.total}
            </p>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() =>
            saveEntry.mutate({
              counterId: id,
              input: { value: 1, occurredAt: new Date(), note: "" },
            })
          }
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

      {entriesError && <ErrorMessage>{entriesError}</ErrorMessage>}

      {entries === null ? (
        !entriesError && (
          <LoadingStatus variant="inline">Wczytywanie wpisów…</LoadingStatus>
        )
      ) : (
        <>
          <CounterCalendar entries={entries} />
          <CounterEntryList
            entries={entries}
            onEdit={(entry) =>
              ShowModal(CounterEntryEditorModal, { counterId: id, entry })
            }
          />
        </>
      )}
    </section>
  );
}
