/**
 * The Bibliografia's year view: every Attempt is one row under the year and
 * month it happened, so an item read in 2025 and again in 2026 shows under
 * both years. Items without any Attempt go in one group at the top.
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

/** One month of a year, e.g. `luty`; its rows are a slice of the year's. */
export type MonthGroup = {
  /** e.g. `2026-02`; unique within the view. */
  key: string;
  label: string;
  rows: YearRow[];
};

export type YearGroup = {
  /** `planned` or the year, e.g. `2026`; unique within the view. */
  key: string;
  label: string;
  rows: YearRow[];
  /** The year's months, newest first; empty for the planned group. */
  months: MonthGroup[];
};

/** Month names as they head a list (nominative), January first. */
export const MONTH_NAMES = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

export const PLANNED_GROUP_LABEL = "Planowane";

/** The day an Attempt is placed by: its end, else its start, else when it was recorded. */
function attemptDay(attempt: AttemptResponse): Date {
  return attempt.endedOn ?? attempt.startedOn ?? attempt.createdAt;
}

/**
 * The year an Attempt belongs to. The client parses date-only fields as local
 * midnight (`parseDate` in the generated runtime), so the local calendar is
 * the one that was entered; the UTC one is a day early east of Greenwich.
 */
export function attemptYear(attempt: AttemptResponse): number {
  return attemptDay(attempt).getFullYear();
}

/** The month (0 = January) an Attempt belongs to, by the same day as its year. */
export function attemptMonth(attempt: AttemptResponse): number {
  return attemptDay(attempt).getMonth();
}

/** Split a year's rows (newest first) into runs of the same month. */
function byMonth(year: number, rows: YearRow[]): MonthGroup[] {
  const months: MonthGroup[] = [];
  for (const row of rows) {
    const month = attemptMonth(row.attempt!);
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const last = months.at(-1);
    if (last?.key === key) last.rows.push(row);
    else months.push({ key, label: MONTH_NAMES[month], rows: [row] });
  }
  return months;
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
      months: [],
    });
  }
  for (const year of [...years.keys()].sort((a, b) => b - a)) {
    const rows = years.get(year) ?? [];
    groups.push({
      key: String(year),
      label: String(year),
      rows,
      months: byMonth(year, rows),
    });
  }
  return groups;
}
