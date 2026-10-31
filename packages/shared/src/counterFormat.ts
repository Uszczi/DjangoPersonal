import type { CounterTileValue, CounterViewMode } from "./stores/counterView";

const entryTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** When an entry happened, in the user's time zone, e.g. `20 października 2026 14:30`. */
export function formatEntryTime(date: Date) {
  return entryTimeFormatter.format(date);
}

/** An entry's value with its sign, e.g. `+1` or `−2`. */
export function signedValue(value: number) {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** Polish plural for the entry count: 1 wpis, 2 wpisy, 5 wpisów. */
export function entryCountLabel(count: number) {
  if (count === 1) return "1 wpis";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} wpisy`;
  }
  return `${count} wpisów`;
}

/**
 * How recently a Counter was used, for its tile: the streak while it lasts
 * (`3 dni pod rząd`), else the days since the last entry
 * (`5 dni od ostatniego wpisu`); `null` before the first entry.
 */
export function counterRecencyLabel(counter: {
  streakDays: number;
  daysSinceLastEntry: number | null;
}): string | null {
  if (counter.streakDays > 0) {
    return `${dayCountLabel(counter.streakDays)} pod rząd`;
  }
  if (counter.daysSinceLastEntry === null) return null;
  return `${dayCountLabel(counter.daysSinceLastEntry)} od ostatniego wpisu`;
}

function dayCountLabel(days: number) {
  return days === 1 ? "1 dzień" : `${days} dni`;
}

/** The Polish word for `count` entries: wpis, wpisy, wpisów. */
function entryWord(count: number) {
  return entryCountLabel(count).slice(String(count).length + 1);
}

export const COUNTER_VIEW_MODE_LABELS: Record<CounterViewMode, string> = {
  rows: "Wiersze",
  tiles: "Kafelki",
};

export const COUNTER_TILE_VALUE_LABELS: Record<CounterTileValue, string> = {
  total: "Suma",
  entries: "Liczba wpisów",
  streak: "Dni pod rząd",
};

/** What a Counter tile shows, given the value chosen for its middle. */
export type CounterTileContent = {
  /** The large number. */
  value: number;
  /** Its accessible name, e.g. `Suma: 5`. */
  valueLabel: string;
  /** A word under the number naming what it counts; `null` for the total. */
  unit: string | null;
  /** The line below: the entry count, or the total when the middle shows something else. */
  caption: string;
  /** The streak or days since the last entry, unless the middle already shows it. */
  recency: string | null;
};

export function counterTileContent(
  counter: {
    total: number;
    entryCount: number;
    streakDays: number;
    daysSinceLastEntry: number | null;
  },
  tileValue: CounterTileValue,
): CounterTileContent {
  const recency = counterRecencyLabel(counter);
  const totalCaption = `Suma: ${counter.total}`;
  switch (tileValue) {
    case "total":
      return {
        value: counter.total,
        valueLabel: totalCaption,
        unit: null,
        caption: entryCountLabel(counter.entryCount),
        recency,
      };
    case "entries":
      return {
        value: counter.entryCount,
        valueLabel: `Liczba wpisów: ${counter.entryCount}`,
        unit: entryWord(counter.entryCount),
        caption: totalCaption,
        recency,
      };
    case "streak":
      return {
        value: counter.streakDays,
        valueLabel: `Dni pod rząd: ${counter.streakDays}`,
        unit: `${counter.streakDays === 1 ? "dzień" : "dni"} pod rząd`,
        caption: totalCaption,
        recency: counter.streakDays > 0 ? null : recency,
      };
  }
}
