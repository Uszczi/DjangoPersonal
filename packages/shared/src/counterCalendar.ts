/**
 * One month of every Counter, as the calendar above the Counters list shows
 * it: per Counter and per local day, how many entries and their sum. Days are
 * local, so an entry late in the evening lands on the day the user saw it.
 */
import { daysInMonth, monthKeyOf, type MonthKey } from "./expenseMonth";
import type { CounterEntryResponse, CounterResponse } from "./generated/api";

export type CounterDay = { count: number; sum: number };

export type CounterMonth = {
  counter: CounterResponse;
  /** Index 0 is the 1st; `null` for a day without entries. */
  days: (CounterDay | null)[];
  /** How many days of the month have at least one entry. */
  activeDays: number;
  /** The largest absolute day sum (at least 1), to scale a day's shade. */
  largestSum: number;
};

export function counterMonths(
  counters: CounterResponse[],
  entriesOf: (counterId: string) => CounterEntryResponse[] | undefined,
  month: MonthKey,
): CounterMonth[] {
  const length = daysInMonth(month);
  return counters.map((counter) => {
    const days: (CounterDay | null)[] = Array.from({ length }, () => null);
    for (const entry of entriesOf(counter.id) ?? []) {
      if (monthKeyOf(entry.occurredAt) !== month) continue;
      const index = entry.occurredAt.getDate() - 1;
      const day = days[index] ?? { count: 0, sum: 0 };
      days[index] = { count: day.count + 1, sum: day.sum + entry.value };
    }
    const active = days.filter((day): day is CounterDay => day !== null);
    return {
      counter,
      days,
      activeDays: active.length,
      largestSum: Math.max(1, ...active.map((day) => Math.abs(day.sum))),
    };
  });
}
