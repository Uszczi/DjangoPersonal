/** Polish labels for a Pozycja's kind and status, shared by the web and the mobile app. */
import type {
  PozycjaResponseKindEnum,
  PozycjaResponseStatusEnum,
} from "./generated/api";

export type PozycjaKind = PozycjaResponseKindEnum;
export type PozycjaStatus = PozycjaResponseStatusEnum;

export const POZYCJA_KIND_LABELS: Record<PozycjaKind, string> = {
  film: "Film",
  book: "Książka",
};

/** What a Pozycja's length counts: pages for a book, minutes for a film. */
export const POZYCJA_LENGTH_LABELS: Record<PozycjaKind, string> = {
  film: "Czas trwania (min)",
  book: "Liczba stron",
};

/** "Do obejrzenia" for a film, "Do przeczytania" for a book, and so on. */
export function pozycjaStatusLabel(status: PozycjaStatus, kind: PozycjaKind) {
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
export function pozycjaByline({
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
