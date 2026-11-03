import { Play } from "lucide-react";
import { useState } from "react";

import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import {
  entryMinutes,
  formatClock,
  formatDuration,
} from "@personal/shared/timeFormat";
import {
  dayLabel,
  groupLogDays,
  LOG_DAYS_STEP,
} from "@personal/shared/timeLog";
import { seriesResolver } from "@personal/shared/timeStats";
import { Button, ErrorMessage } from "@/design-system";
import { useSeriesColor } from "@/lib/chartColors";

/**
 * The Dziennik: stopped entries grouped by day with each day's total, the
 * last two weeks first and older ones on request. A row opens the entry; its
 * play button starts a timer on the same Task or title.
 */
export function TimeLog({
  entries,
  now,
  tasks,
  projects,
  titleOf,
  onEdit,
  onResume,
  error,
}: {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  now: number;
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  titleOf: (entry: TimeEntryResponse) => string;
  onEdit: (entry: TimeEntryResponse) => void;
  onResume: (entry: TimeEntryResponse) => void;
  error: string;
}) {
  const [days, setDays] = useState(LOG_DAYS_STEP);
  const log = groupLogDays(entries, now, days);
  const seriesOf = seriesResolver(tasks, projects);
  const colorOf = useSeriesColor();

  return (
    <div aria-label="Dziennik" role="region">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {log.days.length === 0 && (
        <p className="rounded-[7px] border border-card-line bg-paper px-6 py-5 text-[13px] text-muted">
          {log.hasOlder
            ? `Brak wpisów z ostatnich ${days} dni.`
            : "Nie ma jeszcze wpisów. Uruchom timer albo dodaj wpis ręcznie."}
        </p>
      )}
      {log.days.map((day) => (
        <section
          key={day.key}
          aria-labelledby={`log-day-${day.key}`}
          className="mb-4 rounded-[7px] border border-card-line bg-paper"
        >
          <header className="flex items-center justify-between border-b border-row-line px-4 py-3 sm:px-6">
            <h2
              id={`log-day-${day.key}`}
              className="font-display text-[15px] font-bold text-ink"
            >
              {dayLabel(day.key, now)}
            </h2>
            <span className="font-utility text-[12px] font-semibold text-ink-soft">
              {formatDuration(day.minutes)}
            </span>
          </header>
          <ul>
            {day.entries.map((entry) => {
              const title = titleOf(entry);
              const series = seriesOf(entry);
              const range = `${formatClock(entry.start)}–${entry.end ? formatClock(entry.end) : "…"}`;
              return (
                <li
                  key={entry.id}
                  className="group flex items-center gap-3 border-b border-row-line px-4 py-2.5 last:border-b-0 hover:bg-wash sm:gap-4 sm:px-6"
                >
                  <button
                    type="button"
                    aria-label={`Edytuj wpis: ${title}`}
                    onClick={() => onEdit(entry)}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="truncate text-[14px] text-ink sm:flex-1">
                      {title}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-[12px]">
                      {series.key !== "none" && (
                        <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: colorOf(series.slot) }}
                          />
                          <span className="truncate">{series.name}</span>
                        </span>
                      )}
                      <span className="shrink-0 font-utility text-[11px] text-muted sm:hidden">
                        {range}
                      </span>
                    </span>
                  </button>
                  <span className="hidden w-[100px] shrink-0 text-right font-utility text-[11px] text-muted sm:block">
                    {range}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right font-utility text-[13px] font-semibold text-ink sm:w-[80px]">
                    {formatDuration(entryMinutes(entry))}
                  </span>
                  <button
                    type="button"
                    aria-label={`Wznów: ${title}`}
                    title="Wznów"
                    onClick={() => onResume(entry)}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-icon-wash hover:text-accent focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Play size={14} fill="currentColor" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {log.hasOlder && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => setDays((current) => current + LOG_DAYS_STEP)}
          >
            Pokaż starsze
          </Button>
        </div>
      )}
    </div>
  );
}
