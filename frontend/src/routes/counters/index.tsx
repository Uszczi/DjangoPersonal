import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CounterEditorModal } from "@/components/modals/CounterEditorModal";
import { DeleteCounterModal } from "@/components/modals/DeleteCounterModal";
import { entryCountLabel } from "@/counterFormat";
import {
  Button,
  DeleteButton,
  ErrorMessage,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
  LoadingStatus,
} from "@/design-system";
import type { CounterResponse } from "@/generated/api";
import { useCountersStore } from "@/stores/counters";
import { ShowModal } from "@/stores/modal";

export const Route = createFileRoute("/counters/")({
  component: CountersPage,
});

function CountersPage() {
  const counters = useCountersStore((state) => state.counters);
  const isLoading = useCountersStore((state) => state.isLoading);
  const pageError = useCountersStore((state) => state.pageError);
  const saveEntry = useCountersStore((state) => state.saveEntry);
  const navigate = useNavigate();

  function openCounter(counter: CounterResponse) {
    navigate({ to: "/counters/$counterId", params: { counterId: String(counter.id) } });
  }

  function showCreate() {
    ShowModal(CounterEditorModal, { onSaved: openCounter });
  }

  if (isLoading) {
    return (
      <LoadingStatus>
        Wczytywanie liczników…
      </LoadingStatus>
    );
  }

  if (pageError) {
    return <ErrorMessage>{pageError}</ErrorMessage>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Liczniki</h1>
        <Button variant="primary" onClick={showCreate}>
          <span aria-hidden="true">+</span>
          Nowy licznik
        </Button>
      </div>

      {counters.length === 0 ? (
        <div className="pt-[40px] text-muted">
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK LICZNIKÓW</p>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            Utwórz pierwszy licznik
          </h2>
        </div>
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
                  <ListRowSubtitle>{entryCountLabel(counter.entryCount)}</ListRowSubtitle>
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
                  onClick={() =>
                    void saveEntry(counter.id, { value: 1, occurredAt: new Date(), note: "" })
                  }
                >
                  +1
                </Button>
                <DeleteButton
                  aria-label={`Usuń licznik: ${counter.name}`}
                  onClick={() => ShowModal(DeleteCounterModal, { counter })}
                />
              </>
            </ListRow>
          ))}
        </ul>
      )}
    </>
  );
}
