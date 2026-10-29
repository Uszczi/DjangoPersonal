/** Polish labels for a BibliographyItem's kind and status, shared by the web and the mobile app. */
import type {
  BibliographyItemResponseKindEnum,
  BibliographyItemResponseStatusEnum,
} from "./generated/api";

export type ItemKind = BibliographyItemResponseKindEnum;
export type ItemStatus = BibliographyItemResponseStatusEnum;

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  film: "Film",
  book: "Książka",
};

/** What a BibliographyItem's length counts: pages for a book, minutes for a film. */
export const ITEM_LENGTH_LABELS: Record<ItemKind, string> = {
  film: "Czas trwania (min)",
  book: "Liczba stron",
};

/** "Do obejrzenia" for a film, "Do przeczytania" for a book, and so on. */
export function itemStatusLabel(status: ItemStatus, kind: ItemKind) {
  switch (status) {
    case "planned":
      return kind === "film" ? "Do obejrzenia" : "Do przeczytania";
    case "in_progress":
      return "W trakcie";
    case "finished":
      return "Ukończone";
    case "abandoned":
      return "Porzucone";
  }
}

/** The creator and year line, e.g. `Bolesław Prus · 1890`; empty when neither is known. */
export function itemByline({
  creator,
  year,
}: {
  creator: string;
  year: number | null;
}) {
  return [creator, year === null ? "" : String(year)]
    .filter(Boolean)
    .join(" · ");
}

/** A calendar day as `dd.mm.yyyy`. */
function formatDay(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * An Attempt's dates: `20.10.2026 – 28.10.2026`, `od 20.10.2026` while only
 * the start is known, just the end date when only that was recorded; empty
 * when neither is.
 */
export function attemptDates({
  startedOn,
  endedOn,
}: {
  startedOn: Date | null;
  endedOn: Date | null;
}) {
  if (startedOn && endedOn) {
    return `${formatDay(startedOn)} – ${formatDay(endedOn)}`;
  }
  if (startedOn) return `od ${formatDay(startedOn)}`;
  if (endedOn) return formatDay(endedOn);
  return "";
}
