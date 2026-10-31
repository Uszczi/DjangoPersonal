import type { TransactionResponse } from "@personal/shared/generated/api";
import { dateKey } from "@personal/shared/timeFormat";

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export type DaySection = { title: string; data: TransactionResponse[] };

/** Consecutive transactions grouped by calendar day, keeping the newest-first order. */
export function groupByDay(transactions: TransactionResponse[]): DaySection[] {
  const groups = new Map<string, TransactionResponse[]>();
  for (const transaction of transactions) {
    const key = dateKey(transaction.date);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.values()].map((data) => ({
    title: dayFormatter.format(data[0].date),
    data,
  }));
}
