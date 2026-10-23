import type { IconSuggestion } from "@/design-system";

/**
 * The icons the wallet picker offers before anything is typed. A wallet's
 * icon is optional, and any lucide icon name is accepted; these are just the
 * likely ones.
 */
export const WALLET_ICON_SUGGESTIONS: readonly IconSuggestion[] = [
  { value: "wallet", label: "Portfel" },
  { value: "piggy-bank", label: "Oszczędności" },
  { value: "landmark", label: "Bank" },
  { value: "credit-card", label: "Karta" },
  { value: "banknote", label: "Gotówka" },
  { value: "coins", label: "Monety" },
  { value: "briefcase", label: "Firma" },
  { value: "house", label: "Dom" },
  { value: "car", label: "Samochód" },
  { value: "plane", label: "Podróże" },
  { value: "gift", label: "Prezenty" },
  { value: "graduation-cap", label: "Edukacja" },
  { value: "heart", label: "Rodzina" },
  { value: "baby", label: "Dzieci" },
];
