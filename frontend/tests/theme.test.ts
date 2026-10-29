/** The theme applied to the page: the shared palettes become CSS variables on <html>. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useThemeStore } from "@personal/shared/stores/theme";
import {
  cssVariableName,
  themes,
  type ThemePalette,
} from "@personal/shared/themes";

import { startTheme } from "@/theme";

import { resetStores } from "./renderApp";

function cssVariable(token: keyof ThemePalette) {
  return document.documentElement.style.getPropertyValue(
    cssVariableName(token),
  );
}

/** A `matchMedia` whose dark-scheme answer the test controls. */
function mockSystemScheme(initial: "light" | "dark") {
  let isDark = initial === "dark";
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(prefers-color-scheme: dark)" && isDark;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  return (scheme: "light" | "dark") => {
    isDark = scheme === "dark";
    listeners.forEach((listener) => listener());
  };
}

describe("theme", () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    resetStores();
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    stop();
    vi.unstubAllGlobals();
  });

  test("index.css declares every light-theme token with the shared value", () => {
    // The @theme block is the first paint and what Tailwind builds utilities from.
    const indexCss = readFileSync(
      join(import.meta.dirname, "../src/index.css"),
      "utf8",
    );
    for (const [token, value] of Object.entries(themes.light.colors)) {
      const name = cssVariableName(token as keyof ThemePalette);
      expect(indexCss, name).toContain(`${name}: ${value};`);
    }
  });

  test("every theme's colours are valid CSS colours", () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const [token, value] of Object.entries(theme.colors)) {
        expect(value, `${name}.${token}`).toMatch(
          /^(#[0-9a-f]{6}([0-9a-f]{2})?|rgb\(.+\))$/,
        );
      }
    }
  });

  test("follows the system scheme by default", () => {
    const setSystemScheme = mockSystemScheme("dark");
    stop = startTheme();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(cssVariable("canvas")).toBe(themes.dark.colors.canvas);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    setSystemScheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(cssVariable("canvas")).toBe(themes.light.colors.canvas);
  });

  test("the device's copy of the account theme wins over the system and is persisted", () => {
    mockSystemScheme("dark");
    stop = startTheme();

    useThemeStore.getState().setPreference("sepia");

    expect(document.documentElement.dataset.theme).toBe("sepia");
    expect(cssVariable("signal")).toBe(themes.sepia.colors.signal);
    expect(document.documentElement.style.colorScheme).toBe("light");

    useThemeStore.getState().setPreference("mocha");
    expect(cssVariable("canvas")).toBe("#181825");
    expect(cssVariable("signal")).toBe("#cba6f7");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(JSON.parse(localStorage.getItem("theme") ?? "{}")).toMatchObject({
      state: { preference: "mocha" },
    });
  });

  test("an unknown saved theme falls back to the system", async () => {
    localStorage.setItem(
      "theme",
      JSON.stringify({ state: { preference: "removed" }, version: 0 }),
    );
    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().preference).toBe("system");
  });
});
