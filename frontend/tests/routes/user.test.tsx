/** The account page: picking a theme. */

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { useThemeStore } from "@personal/shared/stores/theme";

import { renderApp } from "../renderApp";

describe("/user", () => {
  afterEach(() => cleanup());

  test("picks a theme", async () => {
    const user = userEvent.setup();
    renderApp("/user");

    const group = await screen.findByRole("group", { name: "Motyw" });
    expect(
      within(group).getByRole("button", { name: "Systemowy" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(within(group).getByRole("button", { name: "Ciemny" }));

    expect(useThemeStore.getState().preference).toBe("dark");
    expect(
      within(group).getByRole("button", { name: "Ciemny" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
