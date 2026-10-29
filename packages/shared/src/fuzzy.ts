/**
 * Fuzzy matching for narrowing a list as the user types, like a fuzzy finder:
 * every word of the query must appear in the text with its letters in order
 * (gaps allowed), ignoring case and Polish diacritics. A match scores higher
 * when its letters sit together and start words, so the closest matches come
 * first.
 */

/** Lower-case without diacritics: "Łódź" → "lodz". */
function fold(text: string) {
  return text
    .toLocaleLowerCase("pl")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const CONSECUTIVE_BONUS = 3;
const WORD_START_BONUS = 2;

function isWordStart(text: string, index: number) {
  return index === 0 || !/[\p{L}\p{N}]/u.test(text[index - 1]);
}

/** The best score of `word` as a subsequence of `text`, or null when it is not one. */
function wordScore(word: string, text: string): number | null {
  let best: number | null = null;
  // Try every place the first letter occurs: "ka" in "Kafka" scores best from the word start, not from the later "k".
  for (
    let start = text.indexOf(word[0]);
    start !== -1;
    start = text.indexOf(word[0], start + 1)
  ) {
    let score = 1 + (isWordStart(text, start) ? WORD_START_BONUS : 0);
    let previous = start;
    let matched = true;
    for (let i = 1; i < word.length; i++) {
      const next = text.indexOf(word[i], previous + 1);
      if (next === -1) {
        matched = false;
        break;
      }
      score += 1;
      if (next === previous + 1) score += CONSECUTIVE_BONUS;
      else if (isWordStart(text, next)) score += WORD_START_BONUS;
      previous = next;
    }
    if (!matched) break; // A later start cannot fit the rest either.
    if (best === null || score > best) best = score;
  }
  return best;
}

/** How well `query` matches `text` (higher is better), or null when some word of it does not match. */
export function fuzzyScore(query: string, text: string): number | null {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const haystack = fold(text);
  let total = 0;
  for (const word of words) {
    const score = wordScore(word, haystack);
    if (score === null) return null;
    total += score;
  }
  return total;
}

/**
 * The items matching `query`, best match first (equal scores keep the list's
 * order); a blank query returns the items unchanged.
 */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  toText: (item: T) => string,
): T[] {
  if (query.trim() === "") return [...items];
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyScore(query, toText(item)),
    }))
    .filter(
      (entry): entry is { item: T; index: number; score: number } =>
        entry.score !== null,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
