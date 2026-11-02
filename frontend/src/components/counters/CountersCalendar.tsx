import { useState } from "react";

import { IconButton } from "@/design-system";
import {
  counterMonths,
  type CounterMonth,
} from "@personal/shared/counterCalendar";
import { entryCountLabel } from "@personal/shared/counterFormat";
import {
  dayOfMonth,
  daysInMonth,
  leadingBlankDays,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  WEEKDAY_LABELS,
  type MonthKey,
} from "@personal/shared/expenseMonth";
import type { CounterResponse } from "@personal/shared/generated/api";
import { useEveryCounterEntries } from "@personal/shared/queries/counters";
import type { CounterCalendarMode } from "@personal/shared/stores/counterView";

const dayName = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

type MonthProps = {
  months: CounterMonth[];
  month: MonthKey;
  todayDay: number | null;
};

/**
 * One calendar for every Counter, above the Counters list: a month grid with
 * a dot per Counter on each day it got entries, or a row of days per Counter.
 */
export function CountersCalendar({
  counters,
  mode,
}: {
  counters: CounterResponse[];
  mode: Exclude<CounterCalendarMode, "hidden">;
}) {
  // Read the clock once, on mount: it picks the starting month and the day to ring.
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthKeyOf(today));
  const entries = useEveryCounterEntries(counters.map(({ id }) => id));
  const months = counterMonths(counters, (id) => entries.get(id), month);
  const todayDay = monthKeyOf(today) === month ? today.getDate() : null;

  return (
    <section aria-label="Kalendarz liczników" className="mb-8">
      <div className="mx-auto mb-2 flex max-w-md items-center justify-between">
        <IconButton
          aria-label="Poprzedni miesiąc"
          onClick={() => setMonth((shown) => shiftMonth(shown, -1))}
        >
          ‹
        </IconButton>
        <h2 className="text-[15px] font-semibold text-ink" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <IconButton
          aria-label="Następny miesiąc"
          onClick={() => setMonth((shown) => shiftMonth(shown, 1))}
        >
          ›
        </IconButton>
      </div>
      {mode === "grid" ? (
        <MonthGrid
          key={month}
          months={months}
          month={month}
          todayDay={todayDay}
        />
      ) : (
        <MonthMatrix months={months} month={month} todayDay={todayDay} />
      )}
    </section>
  );
}

/** The month as one grid; the legend hides Counters, a day opens its sums. */
function MonthGrid({ months, month, todayDay }: MonthProps) {
  const [hidden, setHidden] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const shown = months.filter(({ counter }) => !hidden.has(counter.id));
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);

  function toggle(id: number) {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <div
        role="group"
        aria-label="Liczniki w kalendarzu"
        className="mb-3 flex flex-wrap justify-center gap-2"
      >
        {months.map(({ counter }) => (
          <button
            key={counter.id}
            type="button"
            aria-pressed={!hidden.has(counter.id)}
            onClick={() => toggle(counter.id)}
            className={[
              "flex items-center gap-1.5 rounded-full border border-control-border px-2.5 py-1 text-xs text-ink",
              hidden.has(counter.id) ? "opacity-40" : "",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: counter.color }}
            />
            {counter.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            aria-hidden="true"
            className="py-1 text-[11px] font-semibold text-muted uppercase"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: leadingBlankDays(month) }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const hits = shown.filter(({ days }) => days[day - 1] !== null);
          const names = hits.map(({ counter }) => counter.name).join(", ");
          return (
            <button
              key={day}
              type="button"
              aria-label={`${dayName.format(dayOfMonth(month, day))}: ${names || "brak wpisów"}`}
              aria-pressed={selected === day}
              disabled={hits.length === 0}
              onClick={() => setSelected(selected === day ? null : day)}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-wash text-[13px] text-ink-soft",
                day === todayDay ? "ring-2 ring-signal ring-inset" : "",
                selected === day ? "outline-2 outline-deep-ink" : "",
              ].join(" ")}
            >
              {day}
              <span
                aria-hidden="true"
                className="flex min-h-1.5 flex-wrap justify-center gap-0.5 px-1"
              >
                {hits.map(({ counter }) => (
                  <span
                    key={counter.id}
                    className="size-1.5 rounded-full"
                    style={{ background: counter.color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div
          aria-label={dayName.format(dayOfMonth(month, selected))}
          role="region"
          className="mt-4 rounded-lg border border-card-line bg-paper p-4"
        >
          <p className="m-0 mb-2 text-sm font-semibold text-ink">
            {dayName.format(dayOfMonth(month, selected))}
          </p>
          {shown.map(({ counter, days }) => {
            const day = days[selected - 1];
            if (!day) return null;
            return (
              <div
                key={counter.id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: counter.color }}
                />
                <span className="flex-1 text-ink">{counter.name}</span>
                <span className="text-muted">{entryCountLabel(day.count)}</span>
                <span className="w-12 text-right font-semibold text-ink tabular-nums">
                  {day.sum}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A row of days per Counter; a day's shade follows its sum. */
function MonthMatrix({ months, month, todayDay }: MonthProps) {
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Licznik</span>
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className={
                  day === todayDay
                    ? "w-6 font-bold text-signal"
                    : "w-6 font-normal text-muted"
                }
              >
                {day}
              </th>
            ))}
            <th scope="col" className="pl-2 text-left font-normal text-muted">
              Dni
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map(({ counter, days: tallies, activeDays, largestSum }) => (
            <tr key={counter.id}>
              <th
                scope="row"
                className="sticky left-0 bg-canvas pr-2 text-left text-sm font-normal whitespace-nowrap text-ink"
              >
                {counter.name}
              </th>
              {tallies.map((tally, index) => {
                const label = `${counter.name}, ${dayName.format(dayOfMonth(month, index + 1))}: ${
                  tally
                    ? `${entryCountLabel(tally.count)}, suma ${tally.sum}`
                    : "brak wpisów"
                }`;
                return (
                  <td key={index}>
                    <div
                      role="img"
                      aria-label={label}
                      title={label}
                      className="size-6 rounded-[4px] bg-wash"
                      // The Counter's own colour is data, not a theme token.
                      style={
                        tally
                          ? {
                              background: counter.color,
                              opacity:
                                0.35 +
                                (0.65 * Math.abs(tally.sum)) / largestSum,
                            }
                          : undefined
                      }
                    />
                  </td>
                );
              })}
              <td className="pl-2 text-xs whitespace-nowrap text-muted">
                {activeDays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
