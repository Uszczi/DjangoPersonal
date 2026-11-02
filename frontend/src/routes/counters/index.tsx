import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { CounterList } from "@/components/counters/CounterList";
import { CountersCalendar } from "@/components/counters/CountersCalendar";
import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { CounterSettingsModal } from "@/components/modals/CounterSettingsModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  IconButton,
  LoadingStatus,
  PageHeader,
} from "@/design-system";
import type { CounterResponse } from "@personal/shared/generated/api";
import { COUNTERS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";
import { useCounterViewStore } from "@personal/shared/stores/counterView";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/")({
  component: CountersPage,
});

function CountersPage() {
  const { data: counters = [], isPending, isError } = useCounters();
  const saveEntry = useSaveCounterEntry();
  const navigate = useNavigate();
  const viewMode = useCounterViewStore((state) => state.mode);
  const calendar = useCounterViewStore((state) => state.calendar);

  function addOne(counter: CounterResponse) {
    saveEntry.mutate({
      counterId: counter.id,
      input: { value: 1, occurredAt: new Date(), note: "" },
    });
  }

  function openCounter(counter: CounterResponse) {
    navigate({
      to: "/counters/$counterId",
      params: { counterId: String(counter.id) },
    });
  }

  function showCreate() {
    ShowModal(CounterEditorModal, { onSaved: openCounter });
  }

  if (isPending) {
    return <LoadingStatus>Wczytywanie liczników…</LoadingStatus>;
  }

  if (isError) {
    return <ErrorMessage>{COUNTERS_LOAD_ERROR}</ErrorMessage>;
  }

  return (
    <>
      <PageHeader
        title="Liczniki"
        actions={
          <>
            <IconButton
              aria-label="Ustawienia liczników"
              title="Ustawienia liczników"
              onClick={() => ShowModal(CounterSettingsModal)}
            >
              <Settings size={20} aria-hidden="true" />
            </IconButton>
            <Button variant="primary" onClick={showCreate}>
              <span aria-hidden="true">+</span>
              Nowy licznik
            </Button>
          </>
        }
      />

      {counters.length === 0 ? (
        <EmptyState eyebrow="BRAK LICZNIKÓW" title="Utwórz pierwszy licznik" />
      ) : (
        <>
          {calendar !== "hidden" && (
            <CountersCalendar counters={counters} mode={calendar} />
          )}
          <CounterList
            counters={counters}
            viewMode={viewMode}
            onOpen={openCounter}
            onAddOne={addOne}
          />
        </>
      )}
    </>
  );
}
