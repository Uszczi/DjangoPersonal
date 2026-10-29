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

/** The named colours of a Catppuccin flavour (https://catppuccin.com/palette). */
type CatppuccinFlavor = {
  mauve: string;
  red: string;
  maroon: string;
  peach: string;
  yellow: string;
  green: string;
  teal: string;
  lavender: string;
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
};

/** `a` blended into `b`: `amount` 0 is all `b`, 1 all `a` (both `#rrggbb`). */
function mix(a: string, b: string, amount: number): string {
  const channel = (hex: string, index: number) =>
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return `#${[0, 1, 2]
    .map((index) =>
      Math.round(channel(a, index) * amount + channel(b, index) * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * A Catppuccin flavour mapped onto the app's tokens: mauve is the brand
 * colour, the navigation keeps a dark bar (Latte uses its text colour).
 */
function catppuccin(
  label: string,
  scheme: "light" | "dark",
  c: CatppuccinFlavor,
): Theme {
  const isLight = scheme === "light";
  return {
    label,
    scheme,
    colors: {
      canvas: c.mantle,
      paper: c.base,
      surface: c.base,
      input: isLight ? c.base : c.crust,
      wash: isLight ? c.mantle : c.surface0,
      deepInk: isLight ? c.text : c.crust,
      ink: c.text,
      inkSoft: c.subtext1,
      bodySoft: c.subtext1,
      muted: c.subtext0,
      hint: c.overlay2,
      placeholder: c.overlay0,
      line: c.surface1,
      lineSoft: c.surface0,
      rowLine: c.surface0,
      cardLine: c.surface0,
      controlBorder: c.surface1,
      controlBorderHover: c.overlay0,
      icon: c.overlay2,
      iconWash: isLight ? c.crust : c.surface0,
      dragHandle: c.overlay0,
      accent: c.teal,
      done: c.green,
      signal: c.mauve,
      signalPale: mix(c.mauve, c.base, 0.16),
      signalStrong: c.lavender,
      onSignal: isLight ? c.base : c.crust,
      focusRing: c.lavender,
      danger: c.red,
      dangerStrong: c.maroon,
      dangerPale: mix(c.red, c.base, 0.14),
      dangerInk: c.red,
      overlay: isLight ? `${c.text}73` : `${c.crust}a6`,
      navText: isLight ? c.base : c.text,
      navMuted: isLight ? c.surface1 : c.subtext0,
      navSelected: isLight ? c.subtext0 : c.surface0,
      navHover: isLight ? c.subtext1 : c.mantle,
      navLine: isLight ? c.subtext0 : c.surface1,
      navLineStrong: c.overlay1,
      mdMark: c.peach,
      mdCodeBg: c.mantle,
      searchMatch: mix(c.yellow, c.base, 0.35),
      searchCurrent: mix(c.peach, c.base, 0.5),
    },
  };
}

const latte = catppuccin("Catppuccin Latte", "light", {
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  lavender: "#7287fd",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
});

const frappe = catppuccin("Catppuccin Frappé", "dark", {
  mauve: "#ca9ee6",
  red: "#e78284",
  maroon: "#ea999c",
  peach: "#ef9f76",
  yellow: "#e5c890",
  green: "#a6d189",
  teal: "#81c8be",
  lavender: "#babbf1",
  text: "#c6d0f5",
  subtext1: "#b5bfe2",
  subtext0: "#a5adce",
  overlay2: "#949cbb",
  overlay1: "#838ba7",
  overlay0: "#737994",
  surface2: "#626880",
  surface1: "#51576d",
  surface0: "#414559",
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
});

const macchiato = catppuccin("Catppuccin Macchiato", "dark", {
  mauve: "#c6a0f6",
  red: "#ed8796",
  maroon: "#ee99a0",
  peach: "#f5a97f",
  yellow: "#eed49f",
  green: "#a6da95",
  teal: "#8bd5ca",
  lavender: "#b7bdf8",
  text: "#cad3f5",
  subtext1: "#b8c0e0",
  subtext0: "#a5adcb",
  overlay2: "#939ab7",
  overlay1: "#8087a2",
  overlay0: "#6e738d",
  surface2: "#5b6078",
  surface1: "#494d64",
  surface0: "#363a4f",
  base: "#24273a",
  mantle: "#1e2030",
  crust: "#181926",
});

const mocha = catppuccin("Catppuccin Mocha", "dark", {
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
});

/**
 * Omarchy's Solitude: near-monochrome greys, with its one warm red kept for
 * danger. The brand colour is the theme's light-grey active border.
 */
const solitude: Theme = {
  label: "Solitude",
  scheme: "dark",
  colors: {
    canvas: "#0c0e10",
    paper: "#101315",
    surface: "#14181a",
    input: "#080a0b",
    wash: "#171b1e",
    deepInk: "#080a0b",
    ink: "#cacccc",
    inkSoft: "#b7bcbe",
    bodySoft: "#a5aeb4",
    muted: "#8a9195",
    hint: "#798186",
    placeholder: "#5d6367",
    line: "#2a3033",
    lineSoft: "#1e2326",
    rowLine: "#1e2326",
    cardLine: "#22282b",
    controlBorder: "#343d41",
    controlBorderHover: "#4b4e55",
    icon: "#8a9195",
    iconWash: "#1a1f22",
    dragHandle: "#4b4e55",
    accent: "#9fa5a9",
    done: "#9fa5a9",
    signal: "#a8adb0",
    signalPale: "#262b2e",
    signalStrong: "#d9dbdc",
    onSignal: "#101315",
    focusRing: "#cacccc",
    danger: "#de6145",
    dangerStrong: "#e8826b",
    dangerPale: "#2e1b17",
    dangerInk: "#f0a593",
    overlay: "rgb(0 0 0 / 65%)",
    navText: "#cacccc",
    navMuted: "#798186",
    navSelected: "#1e2326",
    navHover: "#14181a",
    navLine: "#2a3033",
    navLineStrong: "#5d6367",
    mdMark: "#c9c2b4",
    mdCodeBg: "#171b1e",
    searchMatch: "#4a4639",
    searchCurrent: "#7a6f55",
  },
};

export const themes = {
  light,
  dark,
  sepia,
  latte,
  frappe,
  macchiato,
  mocha,
  solitude,
} satisfies Record<string, Theme>;

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
