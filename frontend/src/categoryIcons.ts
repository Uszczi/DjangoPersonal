import type { IconSuggestion } from "@/design-system";

/**
 * The icons the category picker offers before anything is typed, with the
 * Polish names they can be searched by. Any lucide icon name is a valid
 * category icon; these are just the likely ones.
 */
export const CATEGORY_ICON_SUGGESTIONS: readonly IconSuggestion[] = [
  { value: "tag", label: "Etykieta" },
  { value: "utensils", label: "Jedzenie" },
  { value: "coffee", label: "Kawa" },
  { value: "shopping-cart", label: "Zakupy" },
  { value: "shirt", label: "Ubrania" },
  { value: "house", label: "Dom" },
  { value: "zap", label: "Energia" },
  { value: "receipt", label: "Rachunek" },
  { value: "smartphone", label: "Telefon" },
  { value: "car", label: "Samochód" },
  { value: "bus", label: "Komunikacja" },
  { value: "fuel", label: "Paliwo" },
  { value: "plane", label: "Podróże" },
  { value: "heart-pulse", label: "Zdrowie" },
  { value: "pill", label: "Leki" },
  { value: "dumbbell", label: "Sport" },
  { value: "gamepad-2", label: "Gry" },
  { value: "film", label: "Kino" },
  { value: "music", label: "Muzyka" },
  { value: "book-open", label: "Książki" },
  { value: "graduation-cap", label: "Edukacja" },
  { value: "gift", label: "Prezenty" },
  { value: "baby", label: "Dzieci" },
  { value: "paw-print", label: "Zwierzęta" },
  { value: "briefcase", label: "Praca" },
  { value: "piggy-bank", label: "Oszczędności" },
  { value: "wrench", label: "Naprawy" },
  { value: "settings", label: "System" },
];

/** Mirrors the backend's `DEFAULT_CATEGORY_ICON`. */
export const DEFAULT_CATEGORY_ICON = "tag";
