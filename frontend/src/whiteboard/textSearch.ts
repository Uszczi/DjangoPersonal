import { searchKey } from "./folderTree";

/** Where a search matched, as `[start, end)` offsets into the searched text. */
export type TextMatch = { start: number; end: number };

/**
 * `searchKey` applied character by character, so the key has the same length
 * as `text` and an offset in one is the same offset in the other. A character
 * whose key would change the length (a lone combining mark, a ligature) is
 * kept as it is.
 */
function alignedKey(text: string): string {
  let key = "";
  for (const char of text) {
    const folded = searchKey(char);
    key += folded.length === char.length ? folded : char;
  }
  return key;
}

/**
 * Every place `query` matches in `text`, in order, the way the Notatnik
 * search matches: ignoring case and Polish diacritics, each word of the query
 * on its own. Overlapping matches are merged into one.
 */
export function findMatches(text: string, query: string): TextMatch[] {
  const words = searchKey(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const key = alignedKey(text);
  const found: TextMatch[] = [];
  for (const word of words) {
    for (let at = key.indexOf(word); at !== -1; at = key.indexOf(word, at + 1)) {
      found.push({ start: at, end: at + word.length });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: TextMatch[] = [];
  for (const match of found) {
    const last = merged.at(-1);
    if (last && match.start <= last.end) last.end = Math.max(last.end, match.end);
    else merged.push({ ...match });
  }
  return merged;
}
