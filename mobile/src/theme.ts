import { useEffect } from "react";
import { Appearance, Platform, useColorScheme } from "react-native";
import { Uniwind } from "uniwind";

import { useAccountThemeSync } from "@personal/shared/queries/settings";
import { useThemeStore } from "@personal/shared/stores/theme";
import {
  resolveTheme,
  themes,
  type ThemeName,
  type ThemePalette,
} from "@personal/shared/themes";

/**
 * The theme on screen. Components style themselves with Uniwind classes
 * (`global.css`, generated from the shared palettes by `themeCss.js`); the
 * palette here is for what takes plain colours instead: icons, switches,
 * refresh spinners and the navigation options below. Read it through
 * `useTheme()`, never at module scope, or it keeps the first render's theme.
 */
export type Colors = ThemePalette;

/**
 * The tab bar's font, for react-navigation's label style (it takes a font
 * name, not a class). Matches `font-utility` in `themeCss.js`.
 */
const fonts = {
  utility: Platform.select({ ios: "Menlo", default: "monospace" }),
};

/**
 * Copies the account's theme onto this device once signed in. The theme store
 * is only this device's copy of it (persisted so startup and the sign-in
 * screens show the last known theme); mounted once, inside the root layout's
 * query provider.
 */
export function AccountThemeSync(): null {
  useAccountThemeSync();
  return null;
}

/** The theme on screen: the account's pick, or the system's light/dark scheme. */
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
 * Point Uniwind's `className` colours at the chosen theme. "system" stays
 * "system", so Uniwind follows the device's light/dark like `resolveTheme`;
 * forcing light or dark here would also pin `Appearance` and stop
 * `useColorScheme` from following the device. Mounted once, in the root
 * layout, after the theme store has rehydrated.
 */
export function useUniwindTheme() {
  const preference = useThemeStore((state) => state.preference);
  useEffect(() => {
    Uniwind.setTheme(preference);
  }, [preference]);
}

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

/** The web Navbar as a tab bar: deep ink with small monospace labels. */
function tabOptions(colors: Colors) {
  return {
    sceneStyle: { backgroundColor: colors.canvas },
    tabBarStyle: {
      backgroundColor: colors.deepInk,
      borderTopColor: colors.deepInk,
    },
    tabBarActiveTintColor: colors.onSignal,
    tabBarInactiveTintColor: colors.navMuted,
    tabBarActiveBackgroundColor: colors.navSelected,
    tabBarLabelStyle: {
      fontFamily: fonts.utility,
      fontSize: 10,
      fontWeight: "600" as const,
      letterSpacing: 0.6,
    },
  };
}

/** The current theme's palette and the navigation options built from it. */
export function useTheme() {
  const name = useThemeName();
  const colors = themes[name].colors;
  return {
    name,
    scheme: themes[name].scheme,
    colors,
    headerOptions: headerOptions(colors),
    tabOptions: tabOptions(colors),
  };
}
