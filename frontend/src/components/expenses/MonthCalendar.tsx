import {
  dayOfMonth,
  formatCents,
  leadingBlankDays,
  WEEKDAY_LABELS,
  type MonthKey,
  type MonthSummary,
} from "@personal/shared/expenseMonth";

type MonthCalendarProps = {
  month: MonthKey;
  summary: MonthSummary;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
};

const dayName = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

/**
 * The month as a calendar: each day tinted by how much was spent on it, a dot
 * where money came in. A day with transactions toggles the list's day filter.
 */
export function MonthCalendar({
  month,
  summary,
  selectedDay,
  onSelectDay,
}: MonthCalendarProps) {
  const days = summary.days.slice(1);
  const largest = Math.max(1, ...days.map((day) => day.expenseCents));
  const spendingDays = days.filter((day) => day.expenseCents > 0).length;
  const average = spendingDays ? summary.expenseCents / spendingDays : 0;

  return (
    <section
      aria-labelledby="month-calendar-title"
      className="order-1 rounded-xl border border-card-line bg-paper p-4 lg:order-none lg:p-5"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2
          id="month-calendar-title"
          className="font-display text-[17px] font-bold text-ink"
        >
          Miesiąc
        </h2>
        <span className="text-[12px] text-muted">
          {spendingDays} dni z wydatkami · śr.{" "}
          <span className="font-utility">
            {formatCents(Math.round(average))}
          </span>
        </span>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center font-utility text-[10px] text-muted uppercase"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlankDays(month) }, (_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {days.map((total, index) => {
          const day = index + 1;
          const share = total.expenseCents / largest;
          const selected = selectedDay === day;
          const spent = total.expenseCents > 0;
          const label = `${dayName.format(dayOfMonth(month, day))}${
            spent ? `: wydano ${formatCents(total.expenseCents)} zł` : ""
          }`;
          return (
            <button
              key={day}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              disabled={total.count === 0}
              onClick={() => onSelectDay(selected ? null : day)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-[12px] disabled:cursor-default ${selected ? "ring-2 ring-deep-ink" : "hover:enabled:ring-1 hover:enabled:ring-control-border-hover"} ${share > 0.55 ? "text-on-signal" : "text-ink-soft"}`}
              style={{
                background: spent
                  ? `color-mix(in srgb, var(--color-signal) ${Math.round(12 + share * 70)}%, var(--color-paper))`
                  : "var(--color-wash)",
              }}
            >
              <span className={total.count ? "font-semibold" : ""}>{day}</span>
              {spent && (
                <span className="font-utility text-[9px] leading-none opacity-90">
                  {Math.round(total.expenseCents / 100)}
                </span>
              )}
              {total.hasIncome && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-income" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
