import type { TimeEntryResponse } from "@personal/shared/generated/api";
import { dateKey } from "@personal/shared/timeFormat";

/** The date key of the day `days` before `now`. */
export function daysAgoKey(now: number, days: number): string {
  const day = new Date(now);
  day.setDate(day.getDate() - days);
  return dateKey(day);
}

/** An entry's title, else its task's, else a placeholder. */
export function entryTitle(
  entry: TimeEntryResponse,
  taskTitles: ReadonlyMap<number, string>,
): string {
  if (entry.title) return entry.title;
  if (entry.taskId == null) return "Bez tytułu";
  return taskTitles.get(entry.taskId) ?? `Zadanie #${entry.taskId}`;
}
