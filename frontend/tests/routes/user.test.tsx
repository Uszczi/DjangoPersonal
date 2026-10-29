/** The account page: picking the account's theme, kept on the server. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { settingsKeys } from "@personal/shared/queries/keys";
import { useThemeStore } from "@personal/shared/stores/theme";
import { themes } from "@personal/shared/themes";

import { queryClient } from "@/queryClient";

import { renderApp } from "../renderApp";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fake `/api/v1/settings/` holding one theme; `failPatch` refuses writes. */
function fakeSettings(initialTheme: string, options?: { failPatch?: boolean }) {
  let theme = initialTheme;
  const patches: unknown[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (!url.startsWith("/api/v1/settings/")) return jsonResponse([]);
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        patches.push(body);
        if (options?.failPatch) return jsonResponse({ detail: "nope" }, 500);
        theme = body.theme;
      }
      return jsonResponse({ theme });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { patches };
}

function themeGroup() {
  return screen.findByRole("group", { name: "Motyw" });
}

describe("/user", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("shows the account's theme and replaces this device's copy with it", async () => {
    fakeSettings("mocha");
    renderApp("/user", { settings: null });

    const group = await themeGroup();
    await waitFor(() =>
      expect(
        within(group).getByRole("button", { name: themes.mocha.label }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(useThemeStore.getState().preference).toBe("mocha");
    expect(JSON.parse(localStorage.getItem("theme") ?? "{}")).toMatchObject({
      state: { preference: "mocha" },
    });
  });

  test("an account theme this client does not know shows as the system", async () => {
    fakeSettings("from-the-future");
    renderApp("/user", { settings: { theme: "sepia" } });
    await waitFor(() =>
      expect(useThemeStore.getState().preference).toBe("sepia"),
    );
    // The settings reload (as when another device changed them).
    await queryClient.invalidateQueries({ queryKey: settingsKeys.all });

    const group = await themeGroup();
    await waitFor(() =>
      expect(
        within(group).getByRole("button", { name: "Systemowy" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  test("picking a theme switches at once and saves it on the account", async () => {
    const { patches } = fakeSettings("system");
    const user = userEvent.setup();
    renderApp("/user", { settings: null });
    const group = await themeGroup();

    await user.click(within(group).getByRole("button", { name: "Ciemny" }));

    expect(useThemeStore.getState().preference).toBe("dark");
    expect(
      within(group).getByRole("button", { name: "Ciemny" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(patches).toEqual([{ theme: "dark" }]));
  });

  test("a theme the server refuses is rolled back", async () => {
    fakeSettings("sepia", { failPatch: true });
    const user = userEvent.setup();
    renderApp("/user", { settings: null });
    const group = await themeGroup();
    await waitFor(() =>
      expect(useThemeStore.getState().preference).toBe("sepia"),
    );

    await user.click(within(group).getByRole("button", { name: "Ciemny" }));

    expect(
      await screen.findByText(
        "Nie udało się zapisać motywu. Spróbuj ponownie.",
      ),
    ).toBeInTheDocument();
    expect(useThemeStore.getState().preference).toBe("sepia");
    expect(
      within(group).getByRole("button", { name: "Sepia" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
