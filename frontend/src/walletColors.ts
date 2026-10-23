/** The colours a wallet can be given. The API accepts any `#RRGGBB`; the UI offers this palette. */
export const WALLET_COLORS = [
  { value: "#477c7c", label: "Morski" },
  { value: "#d45b3e", label: "Pomarańczowy" },
  { value: "#3d6fb6", label: "Niebieski" },
  { value: "#7a5ab8", label: "Fioletowy" },
  { value: "#c2922b", label: "Musztardowy" },
  { value: "#4f8a3c", label: "Zielony" },
  { value: "#b84a7a", label: "Różowy" },
  { value: "#6c8082", label: "Szary" },
] as const;

/** Mirrors the backend's `DEFAULT_WALLET_COLOR`. */
export const DEFAULT_WALLET_COLOR = WALLET_COLORS[0].value;
