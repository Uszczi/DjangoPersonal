import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { entryCountLabel } from "@personal/shared/counterFormat";
import {
  type CounterViewMode,
  rememberCounterViewMode,
  rememberedCounterViewMode,
} from "@/counterViewMode";
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
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Widok liczników"
            >
              {VIEW_MODES.map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "primary" : "secondary"}
                  aria-pressed={viewMode === mode}
                  onClick={() => changeViewMode(mode)}
                >
                  {VIEW_MODE_LABELS[mode]}
                </Button>
              ))}
            </div>
            <Button variant="primary" onClick={showCreate}>
              <span aria-hidden="true">+</span>
              Nowy licznik
            </Button>
          </>
        }
      />

      {counters.length === 0 ? (
        <div className="pt-[40px] text-muted">
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
            BRAK LICZNIKÓW
          </p>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Utwórz pierwszy licznik
          </h2>
        </div>
      ) : viewMode === "tiles" ? (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
          aria-label="Liczniki"
        >
          {counters.map((counter) => (
            <li
              key={counter.id}
              className="flex flex-col rounded-lg border border-row-line bg-surface"
            >
              <button
                type="button"
                aria-label={`Otwórz licznik: ${counter.name}`}
                onClick={() => openCounter(counter)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 rounded-t-lg border-0 bg-transparent px-4 pt-4 pb-3 text-left font-inherit transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="w-full truncate text-[14px] font-medium text-ink">
                  {counter.name}
                </span>
                <span
                  className="font-utility text-[32px] leading-tight font-semibold text-ink"
                  aria-label={`Suma: ${counter.total}`}
                >
                  {counter.total}
                </span>
                <small className="text-[12px] text-muted">
                  {entryCountLabel(counter.entryCount)}
                </small>
              </button>
              <div className="flex justify-end border-t border-row-line px-3 py-2">
                <Button
                  variant="secondary"
                  aria-label={`Dodaj 1 do licznika: ${counter.name}`}
                  onClick={() => addOne(counter)}
                >
                  +1
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col" aria-label="Liczniki">
          {counters.map((counter) => (
            <ListRow key={counter.id}>
              <ListRowButton
                aria-label={`Otwórz licznik: ${counter.name}`}
                onClick={() => openCounter(counter)}
              >
                <div className="min-w-0">
                  <ListRowTitle>{counter.name}</ListRowTitle>
                  <ListRowSubtitle>
                    {entryCountLabel(counter.entryCount)}
                  </ListRowSubtitle>
                </div>
              </ListRowButton>
              <>
                <span
                  className="mr-2 font-utility text-[18px] font-semibold text-ink"
                  aria-label={`Suma: ${counter.total}`}
                >
                  {counter.total}
                </span>
                <Button
                  variant="secondary"
                  aria-label={`Dodaj 1 do licznika: ${counter.name}`}
                  onClick={() => addOne(counter)}
                >
                  +1
                </Button>
              </>
            </ListRow>
          ))}
        </ul>
      )}
    </>
  );
}
