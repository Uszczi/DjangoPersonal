import { useEffect } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

import { useThemeStore } from "@personal/shared/stores/theme";
import {
  resolveTheme,
  themes,
  type ThemeName,
  type ThemePalette,
} from "@personal/shared/themes";

/**
 * The app's look. Colours come from the theme palettes shared with the web
 * (`@personal/shared/themes`), so they change with the user's pick: styles
 * are built per theme by `makeStyles` and read in components through hooks,
 * never at module scope, or they would keep the colours of the first render.
 */
export type Colors = ThemePalette;

/** The web's font roles; phones lack the web fonts, so each maps to a close system font. */
export const fonts = {
  display: Platform.select({ ios: "Trebuchet MS", default: undefined }),
  utility: Platform.select({ ios: "Menlo", default: "monospace" }),
};

/** The theme on screen: the user's pick, or the system's light/dark scheme. */
export function useThemeName(): ThemeName {
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = useColorScheme();
  return resolveTheme(preference, systemScheme);
}

/**
 * Point the native UI (date pickers, alerts, the keyboard) at the chosen
 * theme's scheme; "unspecified" hands it back to the system. Mounted once, in
 * the root layout.
 */
export function useNativeColorScheme() {
  const preference = useThemeStore((state) => state.preference);
  useEffect(() => {
    Appearance.setColorScheme(
      preference === "system" ? "unspecified" : themes[preference].scheme,
    );
  }, [preference]);
}

/**
 * A hook returning `factory(colors)` as a StyleSheet for the current theme.
 * Each theme's sheet is built once and cached.
 */
type Styles = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<T extends Styles>(
  factory: (colors: Colors) => T & Styles,
): () => Readonly<T> {
  const cache = new Map<ThemeName, Readonly<T>>();
  return function useStyles() {
    const name = useThemeName();
    let styles = cache.get(name);
    if (!styles) {
      styles = StyleSheet.create(factory(themes[name].colors));
      cache.set(name, styles);
    }
    return styles;
  };
}

const useCommon = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.canvas,
  },
  error: { color: colors.danger, padding: 16, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 12 },
  /** A list row (web `ListRow`): no card, a thin line underneath. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 62,
    marginHorizontal: 16,
    paddingHorizontal: 3,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  rowTitle: { fontSize: 14, fontWeight: "500", color: colors.ink },
  rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  /** Small all-caps line above a title (web `PageHeader` eyebrow). */
  eyebrow: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
  /** A page title (web `PageHeader`). */
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.ink,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 4,
  },
  /** The boxed form error (web `ErrorAlert`). */
  alert: {
    borderLeftWidth: 3,
    borderLeftColor: colors.signal,
    backgroundColor: colors.dangerPale,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.dangerInk,
    fontSize: 12,
    lineHeight: 18,
  },
}));

const useCard = makeStyles((colors) => ({
  /** A section card (web `TimerPanel`, `AuthCard`). */
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
    shadowColor: "#1d3739",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  /** Small all-caps line in a card (web eyebrow); colour it `signal` to flag state. */
  kicker: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
  },
}));

const useForm = makeStyles((colors) => ({
  content: { padding: 20, gap: 8 },
  /** Field label (web `Field`). */
  label: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
  hint: { color: colors.hint, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.input,
    color: colors.ink,
  },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  error: { color: colors.dangerInk, marginTop: 8, fontSize: 12 },
  /** The footer of an editor (web `ModalFooter`): a line above the buttons. */
  actions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 26,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
}));

/** Shared screen options: the dark header of the web Navbar. */
function headerOptions(colors: Colors) {
  return {
    headerStyle: { backgroundColor: colors.deepInk },
    headerTintColor: colors.navText,
    headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.canvas },
  };
}

/** Everything a screen styles itself with, for the current theme. */
export function useTheme() {
  const name = useThemeName();
  const colors = themes[name].colors;
  return {
    name,
    scheme: themes[name].scheme,
    colors,
    common: useCommon(),
    card: useCard(),
    form: useForm(),
    headerOptions: headerOptions(colors),
  };
}
