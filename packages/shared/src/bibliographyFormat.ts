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

/** The UI label of a status; for `planned` it depends on the kind (to watch for a film, to read for a book). */
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

export const ITEM_KINDS: readonly ItemKind[] = ["film", "book"];

export const ITEM_STATUSES: readonly ItemStatus[] = [
  "planned",
  "in_progress",
  "finished",
  "abandoned",
];

/** A status filter's label: as on the items of `kind`, or naming both kinds when the list mixes them. */
export function itemStatusFilterLabel(status: ItemStatus, kind?: ItemKind) {
  if (status === "planned" && !kind) return "Do obejrzenia / przeczytania";
  return itemStatusLabel(status, kind ?? "book");
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

/** What the list's search matches a BibliographyItem by: its title, creator and year. */
export function itemSearchText({
  title,
  creator,
  year,
}: {
  title: string;
  creator: string;
  year: number | null;
}) {
  return [title, creator, year === null ? "" : String(year)].join(" ");
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

/** What an Attempt's progress counts: the page of a book, the minute of a film. */
export const ITEM_PROGRESS_LABELS: Record<ItemKind, string> = {
  film: "Minuta",
  book: "Strona",
};

/**
 * An Attempt's progress, e.g. `Strona 170 z 680 · 25%`, or `Minuta 45` when the
 * length is unknown; empty when no progress is recorded. The percentage is
 * rounded down, so it shows 100% only once the length is reached.
 */
export function attemptProgress({
  progress,
  length,
  kind,
}: {
  progress: number | null;
  length: number | null;
  kind: ItemKind;
}) {
  if (progress === null) return "";
  const label = `${ITEM_PROGRESS_LABELS[kind]} ${progress}`;
  if (!length) return label;
  return `${label} z ${length} · ${Math.floor((progress / length) * 100)}%`;
}
