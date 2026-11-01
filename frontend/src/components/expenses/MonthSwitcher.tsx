import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  monthLabel,
  shiftMonth,
  type MonthKey,
} from "@personal/shared/expenseMonth";

type MonthSwitcherProps = {
  month: MonthKey;
  onChange: (month: MonthKey) => void;
};

/** The shown month with arrows to the previous and the next one. */
export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Miesiąc"
      className="flex flex-1 items-center justify-between rounded-lg border border-control-border bg-paper lg:flex-none"
    >
      <button
        type="button"
        aria-label="Poprzedni miesiąc"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="px-3 py-2 text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-live="polite"
        className="text-center text-sm font-semibold text-ink lg:min-w-[150px]"
      >
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Następny miesiąc"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="px-3 py-2 text-ink-soft hover:text-ink"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
