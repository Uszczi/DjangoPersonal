import type { TimeEntryResponse } from "./generated/api";

/** A local calendar day as `yyyy-mm-dd`; the key time entries and transactions are grouped by. */
export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return dateKey(new Date());
}

/** The local midnight a `yyyy-mm-dd` key stands for. */
export function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00`);
}

/** Wall-clock time, e.g. `14:30`. */
export function formatClock(date: Date) {
  return date.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A running timer's elapsed time, e.g. `1:05:09`. */
export function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** A duration, e.g. `45 min`, `2 h`, `1 h 15 min`. */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/** A stopped entry's length in whole minutes; 0 while it is still running. */
export function entryMinutes(entry: TimeEntryResponse) {
  if (!entry.end) return 0;
  return Math.round((entry.end.getTime() - entry.start.getTime()) / 60000);
}
