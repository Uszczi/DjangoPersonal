import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { CounterList } from "@/components/counters/CounterList";
import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { CounterTileSettingsModal } from "@/components/modals/CounterTileSettingsModal";
import {
  Button,
  EmptyState,
  ErrorMessage,
  IconButton,
  LoadingStatus,
  PageHeader,
  ToggleGroup,
} from "@/design-system";
import type { CounterResponse } from "@personal/shared/generated/api";
import { COUNTER_VIEW_MODE_LABELS } from "@personal/shared/counterFormat";
import { COUNTERS_LOAD_ERROR } from "@personal/shared/loadErrors";
import {
  useCounters,
  useSaveCounterEntry,
} from "@personal/shared/queries/counters";
import {
  COUNTER_VIEW_MODES,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/")({
  component: CountersPage,
});

function CountersPage() {
  const { data: counters = [], isPending, isError } = useCounters();
  const saveEntry = useSaveCounterEntry();
  const navigate = useNavigate();
  const viewMode = useCounterViewStore((state) => state.mode);
  const setViewMode = useCounterViewStore((state) => state.setMode);

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
            <ToggleGroup
              label="Widok liczników"
              options={COUNTER_VIEW_MODES}
              labels={COUNTER_VIEW_MODE_LABELS}
              value={viewMode}
              onChange={setViewMode}
            />
            <IconButton
              aria-label="Wygląd kafelków"
              title="Wygląd kafelków"
              onClick={() => ShowModal(CounterTileSettingsModal)}
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
        <CounterList
          counters={counters}
          viewMode={viewMode}
          onOpen={openCounter}
          onAddOne={addOne}
        />
      )}
    </>
  );
}
