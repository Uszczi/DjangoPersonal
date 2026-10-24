/** Today as `yyyy-mm-dd` in the user's local time zone (what a date input holds). */
export function todayKey() {
  return dateKey(new Date());
}

/** Local `yyyy-mm-dd` for a (local-midnight) date the API client hands us. */
export function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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
