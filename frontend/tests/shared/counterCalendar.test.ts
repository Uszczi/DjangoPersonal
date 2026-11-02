import { describe, expect, test } from "vitest";

import { counterMonths } from "@personal/shared/counterCalendar";
import type {
  CounterEntryResponse,
  CounterResponse,
} from "@personal/shared/generated/api";

const counter = { id: 1, name: "Kawa" } as CounterResponse;

function entry(id: number, at: Date, value: number): CounterEntryResponse {
  return {
    id,
    counterId: 1,
    value,
    occurredAt: at,
    note: "",
  } as CounterEntryResponse;
}

describe("counterMonths", () => {
  test("sums each local day of the month and leaves other months out", () => {
    const entries = [
      entry(1, new Date(2026, 9, 20, 0, 30), 2),
      entry(2, new Date(2026, 9, 20, 23, 30), -5),
      entry(3, new Date(2026, 9, 31, 12), 1),
      entry(4, new Date(2026, 10, 1, 0, 0), 9),
    ];

    const [month] = counterMonths([counter], () => entries, "2026-10");

    expect(month.days).toHaveLength(31);
    expect(month.days[19]).toEqual({ count: 2, sum: -3 });
    expect(month.days[30]).toEqual({ count: 1, sum: 1 });
    expect(month.days[0]).toBeNull();
    expect(month.activeDays).toBe(2);
    expect(month.largestSum).toBe(3);
  });

  test("a counter whose entries have not loaded has an empty month", () => {
    const [month] = counterMonths([counter], () => undefined, "2026-02");

    expect(month.days).toHaveLength(28);
    expect(month.activeDays).toBe(0);
    expect(month.largestSum).toBe(1);
  });
});
