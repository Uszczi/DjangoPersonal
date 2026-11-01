import { CategoryIcon } from "@/components/CategoryIcon";
import { formatCents, type MonthSummary } from "@personal/shared/expenseMonth";
import type { CategoryResponse } from "@personal/shared/generated/api";

type CategoryBreakdownProps = {
  summary: MonthSummary;
  categories: CategoryResponse[];
  /** The Category the list is narrowed to (`null` for uncategorised), if any. */
  selected: number | null | undefined;
  onSelect: (categoryId: number | null | undefined) => void;
};

/** "Na co poszło": the month's Expenses by Category, each a bar against the largest; a click narrows the list. */
export function CategoryBreakdown({
  summary,
  categories,
  selected,
  onSelect,
}: CategoryBreakdownProps) {
  const largest = summary.byCategory[0]?.cents ?? 1;

  return (
    <section
      aria-labelledby="category-breakdown-title"
      className="order-3 rounded-xl border border-card-line bg-paper p-4 lg:order-none lg:p-5"
    >
      <h2
        id="category-breakdown-title"
        className="mb-4 font-display text-[17px] font-bold text-ink"
      >
        Na co poszło
      </h2>
      {summary.byCategory.length === 0 && (
        <p className="text-[13px] text-muted">Brak wydatków w tym miesiącu.</p>
      )}
      <ul className="flex flex-col gap-3">
        {summary.byCategory.map((total) => {
          const category = categories.find(
            (item) => item.id === total.categoryId,
          );
          const name = category?.name ?? "Bez kategorii";
          const active = selected === total.categoryId;
          return (
            <li key={total.categoryId ?? "none"}>
              <button
                type="button"
                aria-pressed={active}
                aria-label={`${name}: ${formatCents(total.cents)} zł`}
                onClick={() => onSelect(active ? undefined : total.categoryId)}
                className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-wash ${active ? "bg-wash ring-1 ring-accent" : ""}`}
              >
                <div className="mb-1 flex items-center gap-2 text-sm">
                  {category && (
                    <CategoryIcon icon={category.icon} className="size-4" />
                  )}
                  <span className="flex-1 text-ink">{name}</span>
                  <span className="text-[12px] text-muted">{total.count}×</span>
                  <span className="font-utility text-[13px] font-semibold text-ink">
                    {formatCents(total.cents)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full bg-signal"
                    style={{ width: `${(total.cents / largest) * 100}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
