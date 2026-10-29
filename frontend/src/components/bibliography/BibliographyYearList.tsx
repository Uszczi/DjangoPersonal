import {
  ListRow,
  ListRowButton,
  ListRowSubtitle,
  ListRowTitle,
} from "@/design-system";
import {
  ITEM_KIND_LABELS,
  attemptDates,
  itemByline,
  itemStatusLabel,
} from "@personal/shared/bibliographyFormat";
import type { YearGroup } from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";

/**
 * The year view of the Bibliografia: a heading per year, newest first, with one
 * row per Attempt (so an item seen in two years is listed under both); items
 * without an Attempt come first.
 */
export function BibliographyYearList({
  groups,
  onOpen,
}: {
  groups: YearGroup[];
  onOpen: (item: BibliographyItemResponse) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`year-${group.key}`}>
          <h2
            id={`year-${group.key}`}
            className="mb-1 border-b border-row-line pb-1 font-utility text-[13px] font-semibold tracking-[0.08em] text-muted uppercase"
          >
            {group.label}
          </h2>
          <ul className="flex flex-col" aria-label={group.label}>
            {group.rows.map(({ item, attempt }) => {
              const byline = itemByline(item);
              const dates = attempt ? attemptDates(attempt) : "";
              return (
                <ListRow key={attempt ? `a${attempt.id}` : `i${item.id}`}>
                  <ListRowButton
                    aria-label={`Otwórz pozycję: ${item.title}`}
                    onClick={() => onOpen(item)}
                  >
                    <div className="min-w-0">
                      <ListRowTitle>{item.title}</ListRowTitle>
                      {(byline || dates) && (
                        <ListRowSubtitle>
                          {[byline, dates].filter(Boolean).join(" · ")}
                        </ListRowSubtitle>
                      )}
                    </div>
                  </ListRowButton>
                  <>
                    <span className="mr-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                      {ITEM_KIND_LABELS[item.kind]}
                    </span>
                    <span className="rounded-full border border-row-line px-2 py-0.5 text-[12px] text-ink-soft">
                      {itemStatusLabel(
                        attempt?.outcome ?? "planned",
                        item.kind,
                      )}
                    </span>
                  </>
                </ListRow>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
