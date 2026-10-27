import { useState } from "react";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import {
  dateKey,
  entryMinutes,
  formatClock,
  formatDuration,
} from "@personal/shared/timeFormat";
import {
  ErrorMessage,
  ListRow,
  ListRowButton,
  ListRowTitle,
} from "@/design-system";

import { TimerPanel } from "./TimerPanel";

type EntryRange = "today" | "7" | "30" | "all";

export function RecentEntriesPanel({
  entries,
  now,
  titleOf,
  onEdit,
  error,
}: {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  now: number;
  titleOf: (entry: TimeEntryResponse) => string;
  onEdit: (entry: TimeEntryResponse) => void;
  error: string;
}) {
  const [range, setRange] = useState<EntryRange>("today");

  const today = dateKey(new Date(now));
  const rangeStart = (days: number) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (days - 1));
    return dateKey(day);
  };
  const shown = entries.filter((entry) => {
    const key = dateKey(entry.start);
    if (range === "today") return key === today;
    if (range === "all") return true;
    return key >= rangeStart(range === "7" ? 7 : 30);
  });

  const actions = (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <span>Zakres</span>
        <select
          className="rounded border border-control-border bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-accent focus:ring-[3px] focus:ring-accent/15"
          value={range}
          onChange={(event) => setRange(event.target.value as EntryRange)}
        >
          <option value="today">Dziś</option>
          <option value="7">Ostatnie 7 dni</option>
          <option value="30">Ostatnie 30 dni</option>
          <option value="all">Wszystkie</option>
        </select>
      </label>
      <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
        {shown.length} {shown.length === 1 ? "WPIS" : "WPISÓW"}
      </span>
    </div>
  );

  return (
    <TimerPanel
      title="Ostatnie wpisy"
      headingId="recent-entries-heading"
      actions={actions}
    >
      {shown.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">
          {range === "today"
            ? "Brak wpisów na dziś."
            : "Brak wpisów w wybranym zakresie."}
        </p>
      ) : (
        <ul className="flex flex-col" aria-label="Ostatnie wpisy">
          {shown.map((entry) => (
            <ListRow key={entry.id}>
              <ListRowButton
                aria-label={`Edytuj wpis: ${titleOf(entry)}`}
                onClick={() => onEdit(entry)}
              >
                <span className="shrink-0 font-utility text-[11px] text-muted">
                  {formatClock(entry.start)}–
                  {entry.end ? formatClock(entry.end) : "…"}
                </span>
                <ListRowTitle>{titleOf(entry)}</ListRowTitle>
              </ListRowButton>
              <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
                {formatDuration(entryMinutes(entry)).toUpperCase()}
              </span>
            </ListRow>
          ))}
        </ul>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </TimerPanel>
  );
}
