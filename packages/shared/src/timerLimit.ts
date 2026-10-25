import type { TimeEntryResponse } from "./generated/api";
import { formatDuration } from "./timeFormat";

/** The limits offered when starting a timer, in minutes. */
export const TIMER_LIMIT_MINUTES = [5, 10, 15, 25, 30, 45, 60, 90] as const;

export const timerLimitOptions = TIMER_LIMIT_MINUTES.map((minutes) => ({
  minutes,
  label: formatDuration(minutes),
}));

/**
 * Milliseconds left on a timer started with a limit (never below 0), or
 * `null` for a timer that runs until stopped. `now` should already be
 * corrected by the store's `serverOffset`.
 */
export function timerRemaining(entry: TimeEntryResponse, now: number): number | null {
  if (!entry.plannedEnd) return null;
  return Math.max(0, entry.plannedEnd.getTime() - now);
}
