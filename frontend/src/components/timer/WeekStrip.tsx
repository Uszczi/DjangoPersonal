import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { formatDuration } from "@personal/shared/timeFormat";
import { lastSevenDays, weekdayShort } from "@personal/shared/timeLog";

/** The last seven days' totals as small columns, today in the signal colour. */
export function WeekStrip({
  entries,
  now,
}: {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  now: number;
}) {
  const days = lastSevenDays(entries, now);
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  const top = Math.max(60, ...days.map((day) => day.minutes));

  return (
    <section
      aria-label="Ostatnie 7 dni"
      className="mb-5 flex items-end gap-4 rounded-[7px] border border-card-line bg-paper p-4 sm:gap-6 sm:px-6"
    >
      <div className="shrink-0 sm:min-w-[140px]">
        <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
          OSTATNIE 7 DNI
        </p>
        <p className="font-display text-[22px] font-bold text-ink sm:text-[28px]">
          {formatDuration(total)}
        </p>
      </div>
      <ol className="flex h-16 flex-1 items-end gap-1.5 sm:gap-2">
        {days.map((day, index) => (
          <li
            key={day.key}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={`${day.key} · ${formatDuration(day.minutes)}`}
          >
            <span className="sr-only">
              {day.key}: {formatDuration(day.minutes)}
            </span>
            <span
              aria-hidden="true"
              className={`w-full max-w-[64px] rounded-t-[4px] ${index === days.length - 1 ? "bg-signal" : "bg-accent/60"}`}
              style={{ height: `${Math.max(2, (day.minutes / top) * 44)}px` }}
            />
            <span
              aria-hidden="true"
              className="font-utility text-[10px] text-muted"
            >
              {weekdayShort(day.key)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
