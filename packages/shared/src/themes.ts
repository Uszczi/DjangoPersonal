/**
 * The colour themes both clients offer, as one source of truth.
 *
 * The web turns each key into a CSS custom property (`signalPale` →
 * `--color-signal-pale`, the names Tailwind utilities read); the mobile app
 * reads the palette directly. To add a theme, add an entry to `themes` and
 * its label appears in both pickers.
 */
export type ThemePalette = {
  /** Page background. */
  canvas: string;
  /** Cards, panels and sheets. */
  paper: string;
  /** Inner boxes on a card. */
  surface: string;
  /** Form controls. */
  input: string;
  wash: string;
  /** The navigation bar and sidebar background (dark in every theme). */
  deepInk: string;
  ink: string;
  inkSoft: string;
  /** Secondary body text, e.g. a confirmation question. */
  bodySoft: string;
  muted: string;
  hint: string;
  placeholder: string;
  line: string;
  lineSoft: string;
  rowLine: string;
  /** Border of cards. */
  cardLine: string;
  controlBorder: string;
  controlBorderHover: string;
  icon: string;
  iconWash: string;
  dragHandle: string;
  accent: string;
  /** A completed Task's checkbox. */
  done: string;
  /** The brand colour: primary buttons, the logo, active choices. */
  signal: string;
  signalPale: string;
  signalStrong: string;
  /** Text and icons on `signal` (and on `danger`). */
  onSignal: string;
  focusRing: string;
  danger: string;
  dangerStrong: string;
  dangerPale: string;
  dangerInk: string;
  overlay: string;
  navText: string;
  navMuted: string;
  navSelected: string;
  navHover: string;
  navLine: string;
  navLineStrong: string;
  mdMark: string;
  mdCodeBg: string;
  searchMatch: string;
  searchCurrent: string;
};

export type Theme = {
  /** Shown in the theme pickers (UI strings are Polish). */
  label: string;
  /** Whether native controls (scrollbars, pickers, the keyboard) go light or dark. */
  scheme: "light" | "dark";
  colors: ThemePalette;
};

const light: Theme = {
  label: "Jasny",
  scheme: "light",
  colors: {
    canvas: "#e9eff0",
    paper: "#f8faf7",
    surface: "#f8faf8",
    input: "#ffffff",
    wash: "#f0f4f1",
    deepInk: "#18343b",
    ink: "#1b3439",
    inkSoft: "#344d52",
    bodySoft: "#40595c",
    muted: "#6c8082",
    hint: "#718487",
    placeholder: "#93a5a2",
    line: "#d2ddda",
    lineSoft: "#e1e8e3",
    rowLine: "#dce5e1",
    cardLine: "#dce4df",
    controlBorder: "#cbd7d3",
    controlBorderHover: "#9db0ad",
    icon: "#64797c",
    iconWash: "#eaf0ed",
    dragHandle: "#9aafaa",
    accent: "#477c7c",
    done: "#668b79",
    signal: "#d45b3e",
    signalPale: "#f5e3dc",
    signalStrong: "#b94b31",
    onSignal: "#ffffff",
    focusRing: "#e18a69",
    danger: "#a23a28",
    dangerStrong: "#872d1e",
    dangerPale: "#fff0eb",
    dangerInk: "#873b2b",
    overlay: "rgb(12 29 33 / 52%)",
    navText: "#f4f7f4",
    navMuted: "#b5c6c6",
    navSelected: "#29474d",
    navHover: "#203f45",
    navLine: "#456066",
    navLineStrong: "#6e8b8d",
    mdMark: "#a4482a",
    mdCodeBg: "#eef3f1",
    searchMatch: "#f6e7a8",
    searchCurrent: "#f2b866",
  },
};

const dark: Theme = {
  label: "Ciemny",
  scheme: "dark",
  colors: {
    canvas: "#0f191b",
    paper: "#172427",
    surface: "#1a282b",
    input: "#122023",
    wash: "#1c2b2e",
    deepInk: "#0a1416",
    ink: "#e2ecea",
    inkSoft: "#c4d3d1",
    bodySoft: "#b2c3c1",
    muted: "#8fa3a4",
    hint: "#869a9c",
    placeholder: "#62797b",
    line: "#2c3e41",
    lineSoft: "#243538",
    rowLine: "#263739",
    cardLine: "#29393c",
    controlBorder: "#36494c",
    controlBorderHover: "#536b6e",
    icon: "#93a8a9",
    iconWash: "#1f2f32",
    dragHandle: "#5c7376",
    accent: "#6fa8a6",
    done: "#5f9078",
    signal: "#e0694b",
    signalPale: "#3b2621",
    signalStrong: "#ef8466",
    onSignal: "#ffffff",
    focusRing: "#e18a69",
    danger: "#d7664f",
    dangerStrong: "#ea8470",
    dangerPale: "#36201d",
    dangerInk: "#f1a593",
    overlay: "rgb(0 0 0 / 62%)",
    navText: "#eef4f2",
    navMuted: "#a2b5b5",
    navSelected: "#1e3539",
    navHover: "#172b2f",
    navLine: "#2e474b",
    navLineStrong: "#58767a",
    mdMark: "#e88b69",
    mdCodeBg: "#1f2e31",
    searchMatch: "#665a20",
    searchCurrent: "#9a6529",
  },
};

const sepia: Theme = {
  label: "Sepia",
  scheme: "light",
  colors: {
    canvas: "#eee5d5",
    paper: "#f8f1e4",
    surface: "#f8f2e6",
    input: "#fffaf1",
    wash: "#f2e9d8",
    deepInk: "#3b2f26",
    ink: "#3a2e25",
    inkSoft: "#54463b",
    bodySoft: "#5d4e41",
    muted: "#85735f",
    hint: "#8a7864",
    placeholder: "#a8977f",
    line: "#dccdb5",
    lineSoft: "#e6d9c4",
    rowLine: "#e0d2bc",
    cardLine: "#e2d5bf",
    controlBorder: "#d3c3a9",
    controlBorderHover: "#ae9a7c",
    icon: "#7d6b58",
    iconWash: "#efe3cf",
    dragHandle: "#b3a089",
    accent: "#6b7f4e",
    done: "#6b7f4e",
    signal: "#b9542e",
    signalPale: "#f1dcc9",
    signalStrong: "#9c4424",
    onSignal: "#ffffff",
    focusRing: "#d98a5f",
    danger: "#a23a28",
    dangerStrong: "#872d1e",
    dangerPale: "#fbe9df",
    dangerInk: "#873b2b",
    overlay: "rgb(40 28 18 / 50%)",
    navText: "#f7efe3",
    navMuted: "#cdbba3",
    navSelected: "#54443a",
    navHover: "#4a3c32",
    navLine: "#6a594b",
    navLineStrong: "#9a8572",
    mdMark: "#9c4424",
    mdCodeBg: "#efe4d1",
    searchMatch: "#f3e19a",
    searchCurrent: "#eab160",
  },
};

export const themes = { light, dark, sepia } satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;

/** What the user picked: a named theme, or "follow the system" (light or dark). */
export type ThemePreference = "system" | ThemeName;

export const themePreferences: readonly ThemePreference[] = [
  "system",
  ...(Object.keys(themes) as ThemeName[]),
];

export const themePreferenceLabels: Record<ThemePreference, string> = {
  system: "Systemowy",
  ...(Object.fromEntries(
    Object.entries(themes).map(([name, theme]) => [name, theme.label]),
  ) as Record<ThemeName, string>),
};

/** The theme to show for a preference, given the system's scheme (null when unknown). */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeName {
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

/** `signalPale` → `--color-signal-pale`: the CSS custom property the web reads. */
export function cssVariableName(token: keyof ThemePalette): string {
  return `--color-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}
