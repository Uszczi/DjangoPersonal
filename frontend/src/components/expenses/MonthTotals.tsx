import type { ReactNode } from "react";

import {
  formatCents,
  spendingChange,
  type MonthSummary,
} from "@personal/shared/expenseMonth";

type MonthTotalsProps = {
  summary: MonthSummary;
  /** Spent in the month before, for the change against it. */
  previousExpenseCents: number | undefined;
  walletBalance: string | undefined;
};

/** The month in three tiles: spent (and the change on last month), earned, and the difference. */
export function MonthTotals({
  summary,
  previousExpenseCents,
  walletBalance,
}: MonthTotalsProps) {
  const change =
    previousExpenseCents === undefined
      ? null
      : spendingChange(summary.expenseCents, previousExpenseCents);

  return (
    <div className="mb-6 grid grid-cols-3 gap-2 lg:gap-4">
      <Tile
        label="Wydatki"
        value={formatCents(summary.expenseCents)}
        tone="text-expense"
      >
        {change !== null && (
          <span className={change > 0 ? "text-expense" : "text-income"}>
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}% vs poprz. miesiąc
          </span>
        )}
      </Tile>
      <Tile
        label="Przychody"
        value={formatCents(summary.incomeCents)}
        tone="text-income"
      />
      <Tile
        label="Bilans"
        value={formatCents(summary.netCents, { sign: true })}
        tone={summary.netCents < 0 ? "text-expense" : "text-income"}
      >
        {walletBalance !== undefined && (
          <span>Saldo portfela: {walletBalance}</span>
        )}
      </Tile>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-xl border border-card-line bg-paper px-3 py-3 lg:px-5 lg:py-4"
    >
      <h2 className="truncate font-utility text-[10px] tracking-[0.08em] text-muted uppercase lg:text-[11px]">
        {label}
      </h2>
      <p
        className={`truncate font-display text-[18px] font-bold tracking-[-0.02em] lg:text-[28px] ${tone}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted lg:text-[12px]">{children}</p>
    </section>
  );
}
