import { useMemo, useState } from "react";

import { IconButton } from "@/design-system";
import { entryCountLabel } from "@personal/shared/counterFormat";
import type { CounterEntryResponse } from "@personal/shared/generated/api";

const MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];
const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

/** A local calendar day as `yyyy-m-d`, the key entries are grouped by. */
function dayKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

/**
 * A month view of a Counter's entries: days with at least one entry are marked.
 * Days are local, so an entry late in the evening lands on the day the user saw it.
 */
export function CounterCalendar({ entries }: { entries: CounterEntryResponse[] }) {
  // Read the clock once, on mount: it picks the starting month and the day to ring.
  const [today] = useState(() => new Date());
  const [shown, setShown] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const at = entry.occurredAt;
      const key = dayKey(at.getFullYear(), at.getMonth(), at.getDate());
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const { year, month } = shown;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first: getDay() is 0 for Sunday.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());

  function shiftMonth(delta: number) {
    setShown(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <section aria-label="Kalendarz wpisów" className="mb-8 max-w-sm">
      <div className="mb-2 flex items-center justify-between">
        <IconButton aria-label="Poprzedni miesiąc" onClick={() => shiftMonth(-1)}>
          ‹
        </IconButton>
        <h2 className="text-[15px] font-semibold text-ink" aria-live="polite">
          {MONTHS[month]} {year}
        </h2>
        <IconButton aria-label="Następny miesiąc" onClick={() => shiftMonth(1)}>
          ›
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[13px]">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} aria-hidden="true" className="py-1 text-[11px] font-semibold text-muted">
            {weekday}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} aria-hidden="true" />;
          const key = dayKey(year, month, day);
          const count = countsByDay.get(key) ?? 0;
          const label = `${day} ${MONTHS_GENITIVE[month]}: ${count > 0 ? entryCountLabel(count) : "brak wpisów"}`;
          const marked = count > 0;
          return (
            <div
              key={key}
              aria-label={label}
              title={label}
              data-marked={marked || undefined}
              className={[
                "flex aspect-square items-center justify-center rounded-md",
                marked ? "bg-accent font-semibold text-paper" : "text-ink-soft",
                key === todayKey ? "ring-2 ring-signal ring-inset" : "",
              ].join(" ")}
            >
              {day}
            </div>
          );
        })}
      </div>
    </section>
  );
}
