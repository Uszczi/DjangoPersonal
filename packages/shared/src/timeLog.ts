/**
 * The Czas page's Dziennik, worked out without the DOM so the web and the
 * mobile app group and label Time entries the same way.
 */
import type { TimeEntryResponse } from "./generated/api";
import { dateFromKey, dateKey, entryMinutes } from "./timeFormat";

const WEEKDAYS_SHORT = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
const MONTHS_GENITIVE_SHORT = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];

/** How many days of history the Dziennik shows at first, and adds per "Pokaż starsze". */
export const LOG_DAYS_STEP = 14;

/** What a Time entry is called: its own title, else its Task's, else a placeholder. */
export function entryTitle(
  entry: TimeEntryResponse,
  taskTitles: ReadonlyMap<number, string>,
): string {
  if (entry.title) return entry.title;
  if (entry.taskId == null) return "Bez tytułu";
  return taskTitles.get(entry.taskId) ?? `Zadanie #${entry.taskId}`;
}

/** The date key of the day `days` before `now`. */
export function daysAgoKey(now: number, days: number): string {
  const day = new Date(now);
  day.setDate(day.getDate() - days);
  return dateKey(day);
}

/** A weekday's short Polish name, e.g. `śr`. */
export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[dateFromKey(key).getDay()];
}

/** A day heading: `Dziś · wt, 3 lis`, `Wczoraj · pn, 2 lis`, else `nd, 1 lis`. */
export function dayLabel(key: string, now: number): string {
  const date = dateFromKey(key);
  const base = `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE_SHORT[date.getMonth()]}`;
  if (key === daysAgoKey(now, 0)) return `Dziś · ${base}`;
  if (key === daysAgoKey(now, 1)) return `Wczoraj · ${base}`;
  return base;
}

export type LogDay = {
  key: string;
  minutes: number;
  /** Newest first. */
  entries: TimeEntryResponse[];
};

/**
 * Stopped entries of the last `days` days (today included), one group per day
 * with at least one entry, newest day first; `hasOlder` says whether any
 * entry is older than that.
 */
export function groupLogDays(
  entries: TimeEntryResponse[],
  now: number,
  days: number,
): { days: LogDay[]; hasOlder: boolean } {
  const oldestKey = daysAgoKey(now, days - 1);
  const groups = new Map<string, LogDay>();
  let hasOlder = false;
  const newestFirst = [...entries].sort(
    (a, b) => b.start.getTime() - a.start.getTime(),
  );
  for (const entry of newestFirst) {
    const key = dateKey(entry.start);
    if (key < oldestKey) {
      hasOlder = true;
      continue;
    }
    const group = groups.get(key) ?? { key, minutes: 0, entries: [] };
    group.entries.push(entry);
    group.minutes += entryMinutes(entry);
    groups.set(key, group);
  }
  return { days: [...groups.values()], hasOlder };
}

/** Minutes logged on each of the last seven days, oldest first, today last. */
export function lastSevenDays(
  entries: TimeEntryResponse[],
  now: number,
): { key: string; minutes: number }[] {
  const days = Array.from({ length: 7 }, (_, index) => ({
    key: daysAgoKey(now, 6 - index),
    minutes: 0,
  }));
  const byKey = new Map(days.map((day) => [day.key, day]));
  for (const entry of entries) {
    const day = byKey.get(dateKey(entry.start));
    if (day) day.minutes += entryMinutes(entry);
  }
  return days;
}
