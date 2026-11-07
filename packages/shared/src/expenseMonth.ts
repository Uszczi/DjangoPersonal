/**
 * One month of a Wallet as the Wydatki dashboard shows it: the month key and
 * its calendar, and the month's totals (by Category and by day) computed from
 * its Transactions. Amounts are summed in integer grosze, so the totals stay
 * exact; the wire keeps them as Decimal strings.
 */
import type { TransactionResponse } from "./generated/api";

/** A calendar month, `yyyy-mm`. */
export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_KEY.test(value);
}

/** The month a (local-midnight) date falls in. */
export function monthKeyOf(date: Date): MonthKey {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function parts(month: MonthKey): [number, number] {
  const [year, number] = month.split("-").map(Number);
  return [year, number];
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, number] = parts(month);
  return monthKeyOf(new Date(year, number - 1 + delta, 1));
}

/** The first and the last day of the month, as local-midnight dates. */
export function monthBounds(month: MonthKey): { first: Date; last: Date } {
  const [year, number] = parts(month);
  return { first: new Date(year, number - 1, 1), last: new Date(year, number, 0) };
}

export function daysInMonth(month: MonthKey): number {
  return monthBounds(month).last.getDate();
}

/** How many cells come before the 1st in a week starting on Monday (0–6). */
export function leadingBlankDays(month: MonthKey): number {
  return (monthBounds(month).first.getDay() + 6) % 7;
}

/** A day of the month as a local-midnight date. */
export function dayOfMonth(month: MonthKey, day: number): Date {
  const [year, number] = parts(month);
  return new Date(year, number - 1, day);
}

const monthFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});

/** "Październik 2026". */
export function monthLabel(month: MonthKey): string {
  const text = monthFormatter.format(monthBounds(month).first);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAY_LABELS = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

/** A Decimal string ("-12.5", "12.50") as integer grosze, exactly. */
export function toCents(amount: string): number {
  const negative = amount.trim().startsWith("-");
  const [whole, fraction = ""] = amount.trim().replace(/^[-+]/, "").split(".");
  const cents = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

const centsFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1 384,84"; with `sign`, "+1 384,84" or "−1 384,84". */
export function formatCents(cents: number, { sign = false } = {}): string {
  const text = centsFormatter.format(Math.abs(cents) / 100);
  if (sign) return `${cents < 0 ? "−" : "+"}${text}`;
  return cents < 0 ? `−${text}` : text;
}

/** The Wallets' balances added up, in grosze. */
export function totalBalanceCents(wallets: { balance?: string }[]): number {
  return wallets.reduce((sum, wallet) => sum + toCents(wallet.balance ?? "0"), 0);
}

/** Grosze as the API's decimal string, e.g. `-4599` → `"-45.99"`. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * A Transaction's effect on the balance in grosze: an Expense takes away, an
 * Income adds, a System entry (no kind) carries its own sign.
 */
export function signedCents(transaction: TransactionResponse): number {
  const cents = toCents(transaction.amount);
  if (transaction.kind === "expense") return -Math.abs(cents);
  if (transaction.kind === "income") return Math.abs(cents);
  return cents;
}

export type CategoryTotal = {
  /** `null`: Expenses filed under no Category. */
  categoryId: string | null;
  cents: number;
  count: number;
};

export type DayTotal = {
  /** Spent that day, in grosze (Expenses only). */
  expenseCents: number;
  /** Any money coming in that day (an Income or a positive System entry). */
  hasIncome: boolean;
  count: number;
};

export type MonthSummary = {
  expenseCents: number;
  incomeCents: number;
  /** Income minus Expenses; System entries (corrections) are left out. */
  netCents: number;
  /** Expenses by Category, largest first. */
  byCategory: CategoryTotal[];
  /** Index `day` (1-based) holds that day; index 0 is unused. */
  days: DayTotal[];
};

/** The totals of a month's Transactions (those outside `month` are ignored). */
export function summarizeMonth(
  transactions: TransactionResponse[],
  month: MonthKey,
): MonthSummary {
  const days: DayTotal[] = Array.from({ length: daysInMonth(month) + 1 }, () => ({
    expenseCents: 0,
    hasIncome: false,
    count: 0,
  }));
  const categories = new Map<string | null, CategoryTotal>();
  let expenseCents = 0;
  let incomeCents = 0;

  for (const transaction of transactions) {
    if (monthKeyOf(transaction.date) !== month) continue;
    const day = days[transaction.date.getDate()];
    const cents = signedCents(transaction);
    day.count += 1;
    if (cents > 0) day.hasIncome = true;
    if (transaction.kind === "income") incomeCents += cents;
    if (transaction.kind !== "expense") continue;
    expenseCents -= cents;
    day.expenseCents -= cents;
    const total = categories.get(transaction.categoryId) ?? {
      categoryId: transaction.categoryId,
      cents: 0,
      count: 0,
    };
    total.cents -= cents;
    total.count += 1;
    categories.set(transaction.categoryId, total);
  }

  return {
    expenseCents,
    incomeCents,
    netCents: incomeCents - expenseCents,
    byCategory: [...categories.values()].sort((a, b) => b.cents - a.cents),
    days,
  };
}

/**
 * The change of this month's spending against the previous month's, in
 * percent; `null` when the previous month spent nothing.
 */
export function spendingChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
