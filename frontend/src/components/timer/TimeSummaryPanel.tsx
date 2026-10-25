import type { ReactNode } from "react";

import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { dateKey, entryMinutes, formatDuration } from "@personal/shared/timeFormat";

import type { TaskTitles } from "./entries";
import { TimerPanel } from "./TimerPanel";

export function TimeSummaryPanel({ entries, now, taskTitles }: {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  now: number;
  taskTitles: TaskTitles;
}) {
  const today = dateKey(new Date(now));
  const todaysEntries = entries.filter((entry) => dateKey(entry.start) === today);
  const todaysMinutes = todaysEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0);

  const perTaskMinutes = new Map<number, number>();
  for (const entry of todaysEntries) {
    if (entry.taskId == null) continue;
    perTaskMinutes.set(entry.taskId, (perTaskMinutes.get(entry.taskId) ?? 0) + entryMinutes(entry));
  }

  const dayKeys = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (6 - index));
    return dateKey(day);
  });
  const minutesByDay = new Map(dayKeys.map((key) => [key, 0]));
  for (const entry of entries) {
    const key = dateKey(entry.start);
    const minutes = minutesByDay.get(key);
    if (minutes !== undefined) minutesByDay.set(key, minutes + entryMinutes(entry));
  }

  return (
    <TimerPanel title="Suma czasu" headingId="summary-heading">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard title="Dziś łącznie">
          <p className="mt-2 font-display text-[24px] font-bold text-ink">
            {formatDuration(todaysMinutes)}
          </p>
        </SummaryCard>
        <SummaryCard title="Według zadania (dziś)">
          {perTaskMinutes.size === 0 ? (
            <p className="mt-2 text-[13px] text-muted">Brak wpisów.</p>
          ) : (
            <MinutesList
              rows={[...perTaskMinutes].map(([taskId, minutes]) => ({
                key: taskId,
                label: taskTitles.get(taskId) ?? `Zadanie #${taskId}`,
                minutes,
              }))}
            />
          )}
        </SummaryCard>
        <SummaryCard title="Ostatnie 7 dni">
          <MinutesList
            rows={dayKeys.map((key) => ({ key, label: key, minutes: minutesByDay.get(key) ?? 0 }))}
          />
        </SummaryCard>
      </div>
    </TimerPanel>
  );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-[#dce4df] bg-surface p-4">
      <h3 className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MinutesList({ rows }: {
  rows: { key: string | number; label: string; minutes: number }[];
}) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between text-[13px]">
          <span className="truncate text-ink">{row.label}</span>
          <span className="ml-2 font-utility text-[11px] text-muted">
            {formatDuration(row.minutes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
