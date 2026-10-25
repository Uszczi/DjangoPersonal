import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { CounterList } from "@/components/counters/CounterList";
import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import {
  type CounterViewMode,
  rememberCounterViewMode,
  rememberedCounterViewMode,
} from "@/lib/counterViewMode";
import {
  Button,
  EmptyState,
  ErrorMessage,
  LoadingStatus,
  PageHeader,
  ToggleGroup,
} from "@/design-system";
import type { CounterResponse } from "@personal/shared/generated/api";
import { useCountersStore } from "@personal/shared/stores/counters";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/")({
  component: CountersPage,
});

const VIEW_MODES: CounterViewMode[] = ["rows", "tiles"];

const VIEW_MODE_LABELS: Record<CounterViewMode, string> = {
  rows: "Wiersze",
  tiles: "Kafelki",
};

function CountersPage() {
  const counters = useCountersStore((state) => state.counters);
  const isLoading = useCountersStore((state) => state.isLoading);
  const pageError = useCountersStore((state) => state.pageError);
  const saveEntry = useCountersStore((state) => state.saveEntry);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(rememberedCounterViewMode);

  function changeViewMode(mode: CounterViewMode) {
    setViewMode(mode);
    rememberCounterViewMode(mode);
  }

  function addOne(counter: CounterResponse) {
    void saveEntry(counter.id, { value: 1, occurredAt: new Date(), note: "" });
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

  if (isLoading) {
    return <LoadingStatus>Wczytywanie liczników…</LoadingStatus>;
  }

  if (pageError) {
    return <ErrorMessage>{pageError}</ErrorMessage>;
  }

  return (
    <>
      <PageHeader
        title="Liczniki"
        actions={
          <>
            <ToggleGroup
              label="Widok liczników"
              options={VIEW_MODES}
              labels={VIEW_MODE_LABELS}
              value={viewMode}
              onChange={changeViewMode}
            />
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
