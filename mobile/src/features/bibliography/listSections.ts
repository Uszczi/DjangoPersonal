import type { YearGroup, YearRow } from "@personal/shared/bibliographyYears";
import type { BibliographyItemResponse } from "@personal/shared/generated/api";

/**
 * One section of the list: the planned items under their folding bar, or a
 * run of Attempts under a month rule (and, for a year's first month, its
 * folding bar); without dividers, a year's Attempts with no header at all.
 */
export type Section = {
  key: string;
  year?: { key: string; label: string; count: number };
  month?: string;
  data: YearRow[];
};

/** The item view: one section without a header, the list as it always was. */
export function itemSections(items: BibliographyItemResponse[]): Section[] {
  return [
    { key: "items", data: items.map((item) => ({ item, attempt: null })) },
  ];
}

/** The year view's sections; a folded year (or planned group) is its bar alone. */
export function yearSections(
  groups: YearGroup[],
  dividers: boolean,
  folded: ReadonlySet<string>,
): Section[] {
  return groups.flatMap((group): Section[] => {
    const bar = {
      key: group.key,
      label: group.label,
      count: group.rows.length,
    };
    // The planned items fold under a bar like a year's, dividers or not.
    if (group.key === "planned") {
      return [
        {
          key: group.key,
          year: bar,
          data: folded.has(group.key) ? [] : group.rows,
        },
      ];
    }
    if (!dividers) {
      return [{ key: group.key, data: group.rows }];
    }
    // With dividers, a section per month; the first carries the year bar.
    if (folded.has(group.key)) {
      return [{ key: group.key, year: bar, data: [] }];
    }
    return group.months.map((month, index) => ({
      key: month.key,
      year: index === 0 ? bar : undefined,
      month: month.label,
      data: month.rows,
    }));
  });
}
