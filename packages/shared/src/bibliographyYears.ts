/**
 * The Bibliografia's year view: every Attempt is one row under the year it
 * happened, so an item read in 2025 and again in 2026 shows under both years.
 * Items without any Attempt go in one group at the top.
 */
import type {
  AttemptResponse,
  BibliographyItemResponse,
} from "./generated/api";

/** One row of the year view: an item with one of its Attempts (`null` while planned). */
export type YearRow = {
  item: BibliographyItemResponse;
  attempt: AttemptResponse | null;
};

export type YearGroup = {
  /** `planned` or the year, e.g. `2026`; unique within the view. */
  key: string;
  label: string;
  rows: YearRow[];
};

export const PLANNED_GROUP_LABEL = "Planowane";

/** The day an Attempt is placed by: its end, else its start, else when it was recorded. */
function attemptDay(attempt: AttemptResponse): Date {
  return attempt.endedOn ?? attempt.startedOn ?? attempt.createdAt;
}

/**
 * The year an Attempt belongs to. Date-only fields are parsed as UTC midnight,
 * so the UTC year is the calendar year that was entered.
 */
export function attemptYear(attempt: AttemptResponse): number {
  return attemptDay(attempt).getUTCFullYear();
}

/** Newest first: by its day, an Attempt in progress before ended ones on the same day. */
function newestFirst(a: AttemptResponse, b: AttemptResponse) {
  return (
    attemptDay(b).getTime() - attemptDay(a).getTime() ||
    Number(b.outcome === "in_progress") - Number(a.outcome === "in_progress") ||
    b.id - a.id
  );
}

/**
 * Group `items` (in their list order) by year with `attempts`, newest year first.
 * Attempts of items not in `items` (filtered out or searched away) are left out.
 */
export function groupByYear(
  items: readonly BibliographyItemResponse[],
  attempts: readonly AttemptResponse[],
): YearGroup[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const attempted = new Set<number>();
  const years = new Map<number, YearRow[]>();
  for (const attempt of [...attempts].sort(newestFirst)) {
    const item = byId.get(attempt.itemId);
    if (!item) continue;
    attempted.add(item.id);
    const year = attemptYear(attempt);
    const rows = years.get(year) ?? [];
    rows.push({ item, attempt });
    years.set(year, rows);
  }

  const groups: YearGroup[] = [];
  const planned = items.filter((item) => !attempted.has(item.id));
  if (planned.length > 0) {
    groups.push({
      key: "planned",
      label: PLANNED_GROUP_LABEL,
      rows: planned.map((item) => ({ item, attempt: null })),
    });
  }
  for (const year of [...years.keys()].sort((a, b) => b - a)) {
    groups.push({
      key: String(year),
      label: String(year),
      rows: years.get(year) ?? [],
    });
  }
  return groups;
}
