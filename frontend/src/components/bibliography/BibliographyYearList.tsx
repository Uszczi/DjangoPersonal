import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import {
  Button,
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
import type { YearGroup, YearRow } from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";
import { useBibliographyViewStore } from "@personal/shared/stores/bibliographyView";

type OnOpen = (item: BibliographyItemResponse) => void;

/**
 * The year view of the Bibliografia: one row per Attempt (so an item seen in
 * two years is listed under both), newest first, items without an Attempt on
 * top. With dividers on, each year is a bar that folds its rows away and each
 * month is a thin labelled rule; with them off, the Attempts are one list.
 * Whether dividers show is remembered on the device; folded years are not.
 */
export function BibliographyYearList({
  groups,
  onOpen,
}: {
  groups: YearGroup[];
  onOpen: OnOpen;
}) {
  const dividers = useBibliographyViewStore((state) => state.dividers);
  const setDividers = useBibliographyViewStore((state) => state.setDividers);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const planned = groups.find((group) => group.key === "planned");
  const years = groups.filter((group) => group !== planned);

  function toggleYear(key: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-1">
        {dividers && years.length > 0 && (
          <>
            <Button
              variant="ghost"
              onClick={() => setFolded(new Set(years.map((y) => y.key)))}
            >
              Zwiń wszystko
            </Button>
            <Button variant="ghost" onClick={() => setFolded(new Set())}>
              Rozwiń wszystko
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          aria-pressed={!dividers}
          onClick={() => setDividers(!dividers)}
        >
          {dividers ? (
            <EyeOff aria-hidden="true" className="size-[14px]" />
          ) : (
            <Eye aria-hidden="true" className="size-[14px]" />
          )}
          {dividers ? "Ukryj podziały" : "Pokaż podziały"}
        </Button>
      </div>

      {planned && (
        <section aria-labelledby="year-planned" className="mb-6">
          <h2
            id="year-planned"
            className="mb-1 border-b border-row-line pb-1 font-utility text-[13px] font-semibold tracking-[0.08em] text-muted uppercase"
          >
            {planned.label}
          </h2>
          <Rows label={planned.label} rows={planned.rows} onOpen={onOpen} />
        </section>
      )}

      {!dividers ? (
        years.length > 0 && (
          <Rows
            label="Podejścia"
            rows={years.flatMap((year) => year.rows)}
            onOpen={onOpen}
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          {years.map((year) => {
            const isOpen = !folded.has(year.key);
            return (
              <section key={year.key} aria-labelledby={`year-${year.key}`}>
                <h2 id={`year-${year.key}`}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleYear(year.key)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded border-0 bg-wash px-3 py-2 text-left font-inherit text-ink hover:bg-nav-hover focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {isOpen ? (
                      <ChevronDown aria-hidden="true" className="size-4" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="size-4" />
                    )}
                    <span className="text-[16px] font-semibold">
                      {year.label}
                    </span>
                    <span className="ml-auto text-[12px] font-normal text-muted">
                      {year.rows.length}
                    </span>
                  </button>
                </h2>
                {isOpen &&
                  year.months.map((month) => (
                    <div key={month.key}>
                      <h3 className="mt-3 flex items-center gap-3 font-utility text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                        <span
                          aria-hidden="true"
                          className="h-px flex-1 bg-line"
                        />
                        {month.label}
                        <span
                          aria-hidden="true"
                          className="h-px flex-1 bg-line"
                        />
                      </h3>
                      <Rows
                        label={`${month.label} ${year.label}`}
                        rows={month.rows}
                        onOpen={onOpen}
                      />
                    </div>
                  ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Rows({
  label,
  rows,
  onOpen,
}: {
  label: string;
  rows: YearRow[];
  onOpen: OnOpen;
}) {
  return (
    <ul className="flex flex-col" aria-label={label}>
      {rows.map(({ item, attempt }) => {
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
                {itemStatusLabel(attempt?.outcome ?? "planned", item.kind)}
              </span>
            </>
          </ListRow>
        );
      })}
    </ul>
  );
}
