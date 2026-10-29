/**
 * The client-side checks of the Bibliography's forms, shared so the web and the
 * mobile app reject the same input with the same Polish message before the
 * server would.
 */

/**
 * The problem with an ended Attempt's dates (`yyyy-mm-dd` keys, the start
 * optional), or `""` when they are fine.
 */
export function attemptDatesError({
  startedOn,
  endedOn,
}: {
  startedOn: string;
  endedOn: string;
}) {
  if (!endedOn) return "Podaj datę zakończenia.";
  if (startedOn && endedOn < startedOn) {
    return "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.";
  }
  return "";
}

/**
 * An Attempt's progress typed in a field: a whole number up to the item's
 * length (when known), or `null` for an empty field, which clears it.
 */
export function parseProgress(
  text: string,
  length: number | null,
): { value: number | null } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Postęp musi być nieujemną liczbą całkowitą." };
  }
  const value = Number(trimmed);
  if (length !== null && value > length) {
    return { error: `Postęp nie może przekraczać długości (${length}).` };
  }
  return { value };
}

/**
 * A BibliographyItem's year or length typed in a field: `null` when empty, the
 * number when it is a positive whole number, `undefined` when it is invalid.
 */
export function parseItemNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 ? value : undefined;
}
