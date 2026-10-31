import {
  Button,
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import {
  counterTileContent,
  entryCountLabel,
} from "@personal/shared/counterFormat";
import type { CounterResponse } from "@personal/shared/generated/api";
import {
  type CounterViewMode,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";

type CounterItemProps = {
  counter: CounterResponse;
  onOpen: () => void;
  onAddOne: () => void;
};

function AddOneButton({
  counter,
  onAddOne,
}: Pick<CounterItemProps, "counter" | "onAddOne">) {
  return (
    <Button
      variant="secondary"
      aria-label={`Dodaj 1 do licznika: ${counter.name}`}
      onClick={onAddOne}
    >
      +1
    </Button>
  );
}

function CounterTile({ counter, onOpen, onAddOne }: CounterItemProps) {
  const tileValue = useCounterViewStore((state) => state.tileValue);
  const { value, valueLabel, unit, caption, recency } = counterTileContent(
    counter,
    tileValue,
  );
  return (
    <li className="flex flex-col rounded-lg border border-row-line bg-surface">
      <button
        type="button"
        aria-label={`Otwórz licznik: ${counter.name}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-t-lg border-0 bg-transparent px-4 pt-4 pb-3 text-center font-inherit transition-colors hover:bg-wash focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="w-full truncate text-[14px] font-medium text-ink">
          {counter.name}
        </span>
        <span
          className="font-utility text-[32px] leading-tight font-semibold text-ink"
          aria-label={valueLabel}
        >
          {value}
        </span>
        {unit !== null && (
          <small className="-mt-1 text-[12px] text-muted" aria-hidden="true">
            {unit}
          </small>
        )}
        <small className="text-[12px] text-muted">{caption}</small>
        {recency !== null && (
          <small
            className={`text-[12px] font-medium ${counter.streakDays > 0 ? "text-ink" : "text-muted"}`}
          >
            {recency}
          </small>
        )}
      </button>
      <div className="flex justify-center border-t border-row-line px-3 py-2">
        <AddOneButton counter={counter} onAddOne={onAddOne} />
      </div>
    </li>
  );
}

function CounterRow({ counter, onOpen, onAddOne }: CounterItemProps) {
  return (
    <ListRow>
      <ListRowButton
        aria-label={`Otwórz licznik: ${counter.name}`}
        onClick={onOpen}
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
        <AddOneButton counter={counter} onAddOne={onAddOne} />
      </>
    </ListRow>
  );
}

/** The user's Counters as rows or tiles, each with a quick +1. */
export function CounterList({
  counters,
  viewMode,
  onOpen,
  onAddOne,
}: {
  counters: CounterResponse[];
  viewMode: CounterViewMode;
  onOpen: (counter: CounterResponse) => void;
  onAddOne: (counter: CounterResponse) => void;
}) {
  const Item = viewMode === "tiles" ? CounterTile : CounterRow;
  return (
    <ul
      className={
        viewMode === "tiles"
          ? "grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
          : "flex flex-col"
      }
      aria-label="Liczniki"
    >
      {counters.map((counter) => (
        <Item
          key={counter.id}
          counter={counter}
          onOpen={() => onOpen(counter)}
          onAddOne={() => onAddOne(counter)}
        />
      ))}
    </ul>
  );
}
