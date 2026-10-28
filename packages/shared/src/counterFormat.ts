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
