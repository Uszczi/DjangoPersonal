import { describe, expect, test } from "vitest";

import {
  formatCents,
  isMonthKey,
  leadingBlankDays,
  monthBounds,
  shiftMonth,
  spendingChange,
  summarizeMonth,
  toCents,
} from "@personal/shared/expenseMonth";
import type { TransactionResponse } from "@personal/shared/generated/api";

function transaction(
  id: string,
  amount: string,
  day: number,
  kind: TransactionResponse["kind"],
  categoryId: string | null = null,
): TransactionResponse {
  return {
    id,
    title: `t${id}`,
    amount,
    date: new Date(2026, 9, day),
    description: "",
    categoryId,
    walletId: "1",
    kind,
  };
}

describe("expense month", () => {
  test("Decimal strings become exact grosze", () => {
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("-20.05")).toBe(-2005);
    expect(toCents("7")).toBe(700);
    // Floats would drift here: 0.1 + 0.2 !== 0.3.
    expect(toCents("0.10") + toCents("0.20")).toBe(toCents("0.30"));
  });

  test("grosze read as Polish amounts, signed on request", () => {
    expect(formatCents(1250)).toBe("12,50");
    expect(formatCents(-2005)).toBe("−20,05");
    expect(formatCents(0, { sign: true })).toBe("+0,00");
  });

  test("months shift across years and know their days", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthBounds("2028-02").last.getDate()).toBe(29);
    // 1 October 2026 is a Thursday: three blank cells before it.
    expect(leadingBlankDays("2026-10")).toBe(3);
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
  });

  test("a month sums Expenses and Income apart, leaving System entries out", () => {
    const summary = summarizeMonth(
      [
        transaction("1", "40.10", 24, "expense", "7"),
        transaction("2", "9.90", 24, "expense", null),
        transaction("3", "0.20", 2, "expense", "7"),
        transaction("4", "5000.00", 24, "income", "8"),
        transaction("5", "100.00", 2, null),
      ],
      "2026-10",
    );

    expect(summary.expenseCents).toBe(5020);
    expect(summary.incomeCents).toBe(500000);
    expect(summary.netCents).toBe(494980);
    expect(summary.byCategory).toEqual([
      { categoryId: "7", cents: 4030, count: 2 },
      { categoryId: null, cents: 990, count: 1 },
    ]);
    expect(summary.days[24]).toEqual({
      expenseCents: 5000,
      hasIncome: true,
      count: 3,
    });
    // A positive System entry still marks money coming in that day.
    expect(summary.days[2].hasIncome).toBe(true);
  });

  test("the change on last month needs something spent last month", () => {
    expect(spendingChange(150, 100)).toBe(50);
    expect(spendingChange(50, 100)).toBe(-50);
    expect(spendingChange(50, 0)).toBeNull();
  });
});
