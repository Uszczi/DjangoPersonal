/**
 * The Czas page's Statystyki: totals of the stopped Time entries over a week,
 * a month or a year, split by Project, worked out once for both clients.
 *
 * An entry belongs to a Project through its Task; an entry started on a bare
 * title has none and counts as "Bez projektu".
 */
import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "./generated/api";
import { compareIds } from "./ids";
import { dateKey, entryMinutes } from "./timeFormat";
import { entryTitle } from "./timeLog";

export type StatsPeriod = "week" | "month" | "year";

export const STATS_PERIODS: readonly StatsPeriod[] = ["week", "month", "year"];

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  week: "Tydzień",
  month: "Miesiąc",
  year: "Rok",
};

const MONTHS = [
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
];
const MONTHS_SHORT = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];
const WEEKDAYS_MONDAY_FIRST = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const WEEKDAYS = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

/**
 * The categorical chart colours, in the fixed order the Projects take them
 * (by id, so a Project keeps its colour whatever the period shows). Checked
 * for colour-blind separation against the light and the dark paper; a
 * Project past the last slot folds into "Inne projekty".
 */
const SERIES_COLORS = {
  light: [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#6250d6",
  ],
  dark: [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
  ],
} as const;
const NEUTRAL_COLOR = { light: "#a5b1ae", dark: "#6f7d7a" } as const;

/** A series' colour; `slot` -1 is the neutral grey of "Bez projektu" and "Inne projekty". */
export function seriesColor(slot: number, scheme: "light" | "dark"): string {
  return slot < 0 ? NEUTRAL_COLOR[scheme] : SERIES_COLORS[scheme][slot];
}

export type SeriesMinutes = {
  /** A Project id, `none` for entries without one, `other` for the folded tail. */
  key: string;
  name: string;
  /** Colour slot for `seriesColor`. */
  slot: number;
  minutes: number;
};

export type StatsBucket = {
  key: string;
  /** Under the column: `pn`, `14`, `paź`. */
  label: string;
  /** In a tooltip: `pn, 27 paź`, `październik 2026`. */
  longLabel: string;
  from: Date;
  to: Date;
  minutes: number;
  /** In series order (`TimeStats.series`), only those with time. */
  series: SeriesMinutes[];
};

export type TimeStats = {
  /** `październik 2026`, `27 paź – 2 lis 2026`, `2026`. */
  label: string;
  buckets: StatsBucket[];
  total: number;
  /**
   * Percent change against the previous period; for a period still under
   * way, against the same stretch of the previous one. `null` without data.
   */
  change: number | null;
  /** The period has not ended yet. */
  partial: boolean;
  /** Days with at least one entry. */
  activeDays: number;
  /** Days of the period so far. */
  periodDays: number;
  entryCount: number;
  /** Every series with time, in colour (id) order. */
  series: SeriesMinutes[];
  /** The titles that took the most time, most first. */
  topTitles: { title: string; minutes: number }[];
};

export type StatsInput = {
  /** Stopped Time entries. */
  entries: TimeEntryResponse[];
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  period: StatsPeriod;
  /** 0 for the period containing `now`, 1 for the one before, … */
  offset: number;
  now: number;
};

const TOP_TITLES = 8;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

/** The period `offset` steps before the one containing `now`, cut into buckets. */
export function periodBuckets(
  period: StatsPeriod,
  offset: number,
  now: number,
): { label: string; buckets: Omit<StatsBucket, "minutes" | "series">[] } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (period === "week") {
    const monday = addDays(today, -((today.getDay() + 6) % 7) - 7 * offset);
    const buckets = WEEKDAYS_MONDAY_FIRST.map((label, index) => {
      const from = addDays(monday, index);
      return {
        key: dateKey(from),
        label,
        longLabel: `${label}, ${from.getDate()} ${MONTHS_SHORT[from.getMonth()]}`,
        from,
        to: addDays(from, 1),
      };
    });
    const sunday = buckets[6].from;
    return {
      label: `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getFullYear()}`,
      buckets,
    };
  }
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const days = new Date(
      first.getFullYear(),
      first.getMonth() + 1,
      0,
    ).getDate();
    const buckets = Array.from({ length: days }, (_, index) => {
      const from = new Date(first.getFullYear(), first.getMonth(), index + 1);
      return {
        key: dateKey(from),
        label: String(index + 1),
        longLabel: `${WEEKDAYS[from.getDay()]}, ${index + 1} ${MONTHS_SHORT[from.getMonth()]}`,
        from,
        to: new Date(first.getFullYear(), first.getMonth(), index + 2),
      };
    });
    return {
      label: capitalize(`${MONTHS[first.getMonth()]} ${first.getFullYear()}`),
      buckets,
    };
  }
  const year = today.getFullYear() - offset;
  const buckets = MONTHS_SHORT.map((label, index) => ({
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label,
    longLabel: `${MONTHS[index]} ${year}`,
    from: new Date(year, index, 1),
    to: new Date(year, index + 1, 1),
  }));
  return { label: String(year), buckets };
}

function minutesBetween(entries: TimeEntryResponse[], from: Date, to: Date) {
  let total = 0;
  for (const entry of entries) {
    if (entry.start >= from && entry.start < to) total += entryMinutes(entry);
  }
  return total;
}

/** Whole days from `from` to `to`, rounded so a daylight-saving change does not add one. */
function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Which series (Project, "Inne projekty" or "Bez projektu") an entry counts
 * under. Colour slots go by Project id, so a Project keeps its colour; past
 * the palette the rest fold into "Inne projekty".
 */
export function seriesResolver(
  tasks: TaskResponse[],
  projects: ProjectResponse[],
): (entry: TimeEntryResponse) => Omit<SeriesMinutes, "minutes"> {
  const projectsById = new Map(
    projects.map((project) => [project.id, project]),
  );
  const slotOf = new Map(
    [...projects]
      .sort((a, b) => compareIds(a.id, b.id))
      .map((project, index) => [project.id, index]),
  );
  const taskProject = new Map(tasks.map((task) => [task.id, task.projectId]));
  return (entry) => {
    const projectId =
      entry.taskId == null ? undefined : taskProject.get(entry.taskId);
    const project = projectId == null ? undefined : projectsById.get(projectId);
    if (!project) return { key: "none", name: "Bez projektu", slot: -1 };
    const slot = slotOf.get(project.id) ?? 0;
    if (slot >= SERIES_COLORS.light.length)
      return { key: "other", name: "Inne projekty", slot: -1 };
    return { key: String(project.id), name: project.name, slot };
  };
}

export function computeTimeStats({
  entries,
  tasks,
  projects,
  period,
  offset,
  now,
}: StatsInput): TimeStats {
  const { label, buckets: ranges } = periodBuckets(period, offset, now);
  const from = ranges[0].from;
  const to = ranges[ranges.length - 1].to;
  const endOfToday = new Date(now);
  endOfToday.setHours(24, 0, 0, 0);
  const partial = to.getTime() > now;
  const until = partial ? endOfToday : to;

  const seriesOf = seriesResolver(tasks, projects);
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  /** Series order: by slot, then "Inne projekty", then "Bez projektu". */
  function order(series: SeriesMinutes) {
    if (series.key === "none") return 1000;
    if (series.key === "other") return 999;
    return series.slot;
  }
  function addTo(map: Map<string, SeriesMinutes>, entry: TimeEntryResponse) {
    const series = seriesOf(entry);
    const row = map.get(series.key) ?? { ...series, minutes: 0 };
    row.minutes += entryMinutes(entry);
    map.set(series.key, row);
  }
  const sorted = (map: Map<string, SeriesMinutes>) =>
    [...map.values()].sort((a, b) => order(a) - order(b));

  const inPeriod = entries.filter(
    (entry) => entry.start >= from && entry.start < to,
  );
  const totals = new Map<string, SeriesMinutes>();
  const titles = new Map<string, number>();
  const days = new Set<string>();
  for (const entry of inPeriod) {
    addTo(totals, entry);
    const title = entryTitle(entry, taskTitles);
    titles.set(title, (titles.get(title) ?? 0) + entryMinutes(entry));
    days.add(dateKey(entry.start));
  }

  const buckets = ranges.map((range) => {
    const series = new Map<string, SeriesMinutes>();
    for (const entry of inPeriod) {
      if (entry.start >= range.from && entry.start < range.to)
        addTo(series, entry);
    }
    const rows = sorted(series);
    return {
      ...range,
      series: rows,
      minutes: rows.reduce((sum, row) => sum + row.minutes, 0),
    };
  });
  const total = buckets.reduce((sum, bucket) => sum + bucket.minutes, 0);

  const previous = periodBuckets(period, offset + 1, now).buckets;
  const previousFrom = previous[0].from;
  const previousFullTo = previous[previous.length - 1].to;
  const elapsed = until.getTime() - from.getTime();
  const previousTo = partial
    ? new Date(
        Math.min(previousFullTo.getTime(), previousFrom.getTime() + elapsed),
      )
    : previousFullTo;
  const previousTotal = minutesBetween(entries, previousFrom, previousTo);

  return {
    label,
    buckets,
    total,
    change:
      previousTotal > 0
        ? Math.round(((total - previousTotal) / previousTotal) * 100)
        : null,
    partial,
    activeDays: days.size,
    periodDays: Math.max(0, daysBetween(from, until)),
    entryCount: inPeriod.length,
    series: sorted(totals),
    topTitles: [...titles]
      .map(([title, minutes]) => ({ title, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, TOP_TITLES),
  };
}

/** Consecutive days with an entry: the run reaching today (or yesterday), and the longest. */
export function dayStreaks(
  entries: TimeEntryResponse[],
  now: number,
): { current: number; best: number } {
  const days = new Set(entries.map((entry) => dateKey(entry.start)));
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of [...days].sort()) {
    const day = new Date(`${key}T00:00:00`);
    run = previous && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  let current = 0;
  const cursor = new Date(now);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

/** The chart's value axis: a round top in whole hours and the hour ticks up to it. */
export function hourTicks(maxMinutes: number): {
  maxMinutes: number;
  ticks: number[];
} {
  const hours = Math.max(1, Math.ceil(maxMinutes / 60));
  const step =
    hours <= 4
      ? 1
      : hours <= 8
        ? 2
        : hours <= 20
          ? 5
          : hours <= 50
            ? 10
            : hours <= 100
              ? 25
              : 50;
  const top = Math.ceil(hours / step) * step;
  return {
    maxMinutes: top * 60,
    ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step),
  };
}
