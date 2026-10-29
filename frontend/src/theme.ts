import { useSyncExternalStore } from "react";

import { useThemeStore } from "@personal/shared/stores/theme";
import {
  cssVariableName,
  resolveTheme,
  themes,
  type ThemeName,
  type ThemePalette,
} from "@personal/shared/themes";

/**
 * Applies the chosen theme to the page: this device's copy of the account's
 * theme (`@personal/shared/stores/theme`, kept in step with the server by
 * `useAccountThemeSync` in the root route). The palettes live in
 * `@personal/shared/themes`; here each colour becomes the CSS custom property
 * Tailwind's utilities read (`--color-paper`, …), set inline on `<html>` so it
 * overrides the light defaults declared in `index.css`'s `@theme` block.
 */
const darkQuery = "(prefers-color-scheme: dark)";

function systemScheme(): "light" | "dark" {
  return typeof window.matchMedia === "function" &&
    window.matchMedia(darkQuery).matches
    ? "dark"
    : "light";
}

function currentThemeName(): ThemeName {
  return resolveTheme(useThemeStore.getState().preference, systemScheme());
}

function applyTheme(name: ThemeName) {
  const root = document.documentElement;
  const theme = themes[name];
  for (const [token, value] of Object.entries(theme.colors)) {
    root.style.setProperty(cssVariableName(token as keyof ThemePalette), value);
  }
  root.style.colorScheme = theme.scheme;
  root.dataset.theme = name;
}

function subscribeToSystemScheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Apply the theme now (before the first render, so there is no flash) and
 * keep it applied as the preference or the system scheme changes.
 */
export function startTheme(): () => void {
  const refresh = () => applyTheme(currentThemeName());
  refresh();
  const unsubscribeStore = useThemeStore.subscribe(refresh);
  const unsubscribeSystem = subscribeToSystemScheme(refresh);
  return () => {
    unsubscribeStore();
    unsubscribeSystem();
  };
}

/** The theme on screen, for drawing code (canvas) that must repaint when it changes. */
export function useThemeName(): ThemeName {
  const preference = useThemeStore((state) => state.preference);
  const scheme = useSyncExternalStore(subscribeToSystemScheme, systemScheme);
  return resolveTheme(preference, scheme);
}
