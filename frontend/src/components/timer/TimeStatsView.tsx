import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import { formatDuration } from "@personal/shared/timeFormat";
import {
  computeTimeStats,
  dayStreaks,
  hourTicks,
  STATS_PERIOD_LABELS,
  STATS_PERIODS,
  type SeriesMinutes,
  type StatsBucket,
  type StatsPeriod,
  type TimeStats,
} from "@personal/shared/timeStats";
import { ToggleGroup } from "@/design-system";
import { useSeriesColor } from "@/lib/chartColors";

const COMPARED_WITH: Record<StatsPeriod, string> = {
  week: "poprzedni tydzień",
  month: "poprzedni miesiąc",
  year: "poprzedni rok",
};

/** Statystyki: one week, month or year of the stopped entries, split by Project. */
export function TimeStatsView({
  entries,
  tasks,
  projects,
  now,
}: {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  now: number;
}) {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [offset, setOffset] = useState(0);
  const colorOf = useSeriesColor();

  const stats = computeTimeStats({
    entries,
    tasks,
    projects,
    period,
    offset,
    now,
  });
  const streaks = dayStreaks(entries, now);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ToggleGroup
          label="Okres"
          options={STATS_PERIODS}
          labels={STATS_PERIOD_LABELS}
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setOffset(0);
          }}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Poprzedni okres"
            onClick={() => setOffset(offset + 1)}
            className={navButton}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Następny okres"
            disabled={offset === 0}
            onClick={() => setOffset(offset - 1)}
            className={navButton}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <h2
          className="font-display text-[18px] font-bold text-ink"
          aria-live="polite"
        >
          {stats.label}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Łącznie"
          value={formatDuration(stats.total)}
          note={changeNote(stats, period)}
          tone={
            stats.change == null ? undefined : stats.change >= 0 ? "up" : "down"
          }
        />
        <StatTile
          label="Średnio na aktywny dzień"
          value={formatDuration(
            stats.activeDays ? Math.round(stats.total / stats.activeDays) : 0,
          )}
          note={`${stats.entryCount} ${stats.entryCount === 1 ? "wpis" : "wpisów"}`}
        />
        <StatTile
          label="Aktywne dni"
          value={String(stats.activeDays)}
          note={`z ${stats.periodDays} dni`}
        />
        <StatTile
          label="Seria dni z rzędu"
          value={String(streaks.current)}
          note={`rekord: ${streaks.best}`}
        />
      </div>

      <section
        aria-labelledby="stats-chart-heading"
        className="rounded-[7px] border border-card-line bg-paper p-4 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id="stats-chart-heading"
            className="font-display text-[16px] font-bold text-ink"
          >
            {period === "year" ? "Czas w miesiącach" : "Czas w dniach"}
          </h3>
          <Legend series={stats.series} colorOf={colorOf} />
        </div>
        {stats.total === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">
            Brak wpisów w tym okresie.
          </p>
        ) : (
          <StackedColumns
            buckets={stats.buckets}
            period={period}
            colorOf={colorOf}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="stats-projects-heading"
          className="rounded-[7px] border border-card-line bg-paper p-4 sm:p-6"
        >
          <h3
            id="stats-projects-heading"
            className="mb-4 font-display text-[16px] font-bold text-ink"
          >
            Według projektu
          </h3>
          <BarList
            rows={[...stats.series]
              .sort((a, b) => b.minutes - a.minutes)
              .map((row) => ({
                key: row.key,
                label: row.name,
                minutes: row.minutes,
                color: colorOf(row.slot),
              }))}
            total={stats.total}
          />
        </section>
        <section
          aria-labelledby="stats-titles-heading"
          className="rounded-[7px] border border-card-line bg-paper p-4 sm:p-6"
        >
          <h3
            id="stats-titles-heading"
            className="mb-4 font-display text-[16px] font-bold text-ink"
          >
            Najwięcej czasu na
          </h3>
          <BarList
            rows={stats.topTitles.map((row) => ({
              key: row.title,
              label: row.title,
              minutes: row.minutes,
              color: "var(--color-accent)",
            }))}
            total={stats.total}
          />
        </section>
      </div>
    </div>
  );
}

const navButton =
  "grid size-9 cursor-pointer place-items-center rounded border border-control-border bg-transparent text-ink-soft hover:bg-surface disabled:cursor-default disabled:opacity-40";

function changeNote(stats: TimeStats, period: StatsPeriod) {
  if (stats.change == null) return "brak danych do porównania";
  const arrow = stats.change >= 0 ? "▲" : "▼";
  const stretch = stats.partial ? " (ten sam odcinek)" : "";
  return `${arrow} ${Math.abs(stats.change)}% vs ${COMPARED_WITH[period]}${stretch}`;
}

function StatTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "up" | "down";
}) {
  const noteColor =
    tone === "up"
      ? "text-income"
      : tone === "down"
        ? "text-expense"
        : "text-muted";
  return (
    <div className="rounded-[7px] border border-card-line bg-paper px-4 py-4 sm:px-5">
      <p className="font-utility text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-[20px] font-bold text-ink sm:text-[26px]">
        {value}
      </p>
      <p className={`text-[12px] ${noteColor}`}>{note}</p>
    </div>
  );
}

function Legend({
  series,
  colorOf,
}: {
  series: SeriesMinutes[];
  colorOf: (slot: number) => string;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
      {series.map((row) => (
        <li
          key={row.key}
          className="flex items-center gap-1.5 text-[12px] text-ink-soft"
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm"
            style={{ background: colorOf(row.slot) }}
          />
          {row.name}
        </li>
      ))}
    </ul>
  );
}

const CHART_HEIGHT = 220;

/**
 * One column per day (or month), its Projects stacked in colour order. Hover,
 * focus or a tap shows the column's split; a hidden table carries the same
 * numbers for screen readers.
 */
function StackedColumns({
  buckets,
  period,
  colorOf,
}: {
  buckets: StatsBucket[];
  period: StatsPeriod;
  colorOf: (slot: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { maxMinutes, ticks } = hourTicks(
    Math.max(...buckets.map((bucket) => bucket.minutes)),
  );
  const y = (minutes: number) => (minutes / maxMinutes) * CHART_HEIGHT;
  const shown = active == null ? null : buckets[active];
  // Month columns are narrow; label every fifth day.
  const labelled = (index: number) =>
    period !== "month" || index % 5 === 0 || index === buckets.length - 1;

  return (
    <div>
      <div className="flex" aria-hidden="true">
        <div
          className="relative mr-2 w-9 shrink-0"
          style={{ height: CHART_HEIGHT }}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 font-utility text-[10px] text-muted"
              style={{ top: CHART_HEIGHT - y(tick * 60) }}
            >
              {tick} h
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <div
              key={tick}
              className={`absolute inset-x-0 border-t ${tick === 0 ? "border-control-border" : "border-line-soft"}`}
              style={{ top: CHART_HEIGHT - y(tick * 60) }}
            />
          ))}
          <div
            className="relative flex items-end gap-[2px] sm:gap-1"
            style={{ height: CHART_HEIGHT }}
            onMouseLeave={() => setActive(null)}
          >
            {buckets.map((bucket, index) => (
              <button
                key={bucket.key}
                type="button"
                tabIndex={-1}
                className="flex h-full min-w-0 flex-1 cursor-default flex-col justify-end border-0 bg-transparent p-0"
                onMouseEnter={() => setActive(index)}
                onClick={() => setActive(active === index ? null : index)}
              >
                <span
                  className={`mx-auto flex w-full max-w-[44px] flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity ${active != null && active !== index ? "opacity-50" : ""}`}
                >
                  {bucket.series.map((row) => (
                    <span
                      key={row.key}
                      className="block"
                      style={{
                        height: Math.max(1, y(row.minutes) - 2),
                        background: colorOf(row.slot),
                      }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
          {shown && active != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max max-w-[240px] rounded-[5px] bg-deep-ink px-3 py-2 text-[12px] text-nav-text shadow-lg"
              style={{
                left: `${((active + 0.5) / buckets.length) * 100}%`,
                transform: `translateX(${active < buckets.length / 3 ? "0" : active > (buckets.length * 2) / 3 ? "-100%" : "-50%"})`,
              }}
            >
              <p className="font-semibold">
                {shown.longLabel} · {formatDuration(shown.minutes)}
              </p>
              {shown.series.map((row) => (
                <p key={row.key} className="flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: colorOf(row.slot) }}
                  />
                  {row.name}: {formatDuration(row.minutes)}
                </p>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex gap-[2px] sm:gap-1">
            {buckets.map((bucket, index) => (
              <span
                key={bucket.key}
                className="min-w-0 flex-1 text-center font-utility text-[10px] text-muted"
              >
                {labelled(index) ? bucket.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* A table ignores the 1px width of sr-only, so the wrapper carries it. */}
      <div className="sr-only">
        <table>
          <caption>Czas w okresie</caption>
          <thead>
            <tr>
              <th scope="col">{period === "year" ? "Miesiąc" : "Dzień"}</th>
              <th scope="col">Czas</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row">{bucket.longLabel}</th>
                <td>
                  {formatDuration(bucket.minutes)}
                  {bucket.series.length > 0 &&
                    ` (${bucket.series.map((row) => `${row.name}: ${formatDuration(row.minutes)}`).join(", ")})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarList({
  rows,
  total,
}: {
  rows: { key: string; label: string; minutes: number; color: string }[];
  total: number;
}) {
  if (rows.length === 0)
    return <p className="text-[13px] text-muted">Brak wpisów w tym okresie.</p>;
  const top = Math.max(1, ...rows.map((row) => row.minutes));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{row.label}</span>
            <span className="shrink-0 font-utility text-[11px] text-ink-soft">
              {formatDuration(row.minutes)} ·{" "}
              {Math.round((row.minutes / Math.max(1, total)) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-line-soft" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(row.minutes / top) * 100}%`,
                background: row.color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
