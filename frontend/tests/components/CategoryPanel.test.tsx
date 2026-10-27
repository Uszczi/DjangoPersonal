/** User-visible Category flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

const inbox = { id: 1, name: "Inbox", description: "", is_inbox: true };

// API returns snake_case; the generated client maps it to camelCase.
const catJedzenie = {
  id: 1,
  name: "Jedzenie",
  icon: "utensils",
  is_system: false,
};
const catTransport = {
  id: 2,
  name: "Transport",
  icon: "car",
  is_system: false,
};
const catSystem = { id: 3, name: "System", icon: "settings", is_system: true };

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The panel mounts only after the wallets finish loading: wallets, projects, categories.
 * No wallets, so no wallet view joins in with its own transaction/category fetches.
 */
function mockInitial(categories: unknown[]) {
  return {
    wallets: jsonResponse([]),
    projects: jsonResponse([inbox]),
    categories: jsonResponse(categories),
  };
}

describe("Categories", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("category panel lists the categories", async () => {
    const initial = mockInitial([catJedzenie, catTransport]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);

    renderApp("/expenses");

    const list = await screen.findByRole("list", { name: "Lista kategorii" });
    expect(within(list).getByText("Jedzenie")).toBeInTheDocument();
    expect(within(list).getByText("Transport")).toBeInTheDocument();
  });

  test("seeded base categories appear in the panel", async () => {
    const seeded = [
      "Jedzenie",
      "Mieszkanie",
      "Transport",
      "Zdrowie",
      "Rozrywka",
      "Zakupy",
      "Rachunki",
      "Edukacja",
      "Podróże",
      "Inne",
    ].map((name, index) => ({ id: index + 1, name }));
    const initial = mockInitial(seeded);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);

    renderApp("/expenses");

    const list = await screen.findByRole("list", { name: "Lista kategorii" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(within(list).getByText("Jedzenie")).toBeInTheDocument();
    expect(within(list).getByText("Inne")).toBeInTheDocument();
  });

  test("the System category is hidden from the panel", async () => {
    const initial = mockInitial([catJedzenie, catSystem]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);

    renderApp("/expenses");

    const list = await screen.findByRole("list", { name: "Lista kategorii" });
    expect(within(list).getByText("Jedzenie")).toBeInTheDocument();
    expect(within(list).queryByText("System")).not.toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  test("user can create a category inline", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(
        jsonResponse({ id: 9, name: "Rachunki", icon: "tag" }, 201),
      );
    const user = userEvent.setup();

    renderApp("/expenses");
    const list = await screen.findByRole("list", { name: "Lista kategorii" });

    await user.type(screen.getByLabelText("Nowa kategoria"), "  Rachunki  ");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));

    expect(await within(list).findByText("Rachunki")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/v1/categories/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Rachunki", icon: "tag" }),
      }),
    );
  });

  test("duplicate category name shows an error", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(
        jsonResponse(
          { detail: "A category with this name already exists." },
          400,
        ),
      );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByRole("list", { name: "Lista kategorii" });

    await user.type(screen.getByLabelText("Nowa kategoria"), "jedzenie");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A category with this name already exists.",
    );
  });

  test("user can rename a category inline", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(
        jsonResponse({ id: 1, name: "Żywność", icon: "utensils" }),
      );
    const user = userEvent.setup();

    renderApp("/expenses");
    const list = await screen.findByRole("list", { name: "Lista kategorii" });

    await user.click(
      await screen.findByRole("button", {
        name: "Zmień nazwę kategorii: Jedzenie",
      }),
    );
    const input = screen.getByLabelText("Nazwa kategorii");
    await user.clear(input);
    await user.type(input, "Żywność");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(await within(list).findByText("Żywność")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/v1/categories/1/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Żywność", icon: "utensils" }),
      }),
    );
  });

  test("user can delete a category after confirming", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(jsonResponse(null, 204));
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByRole("list", { name: "Lista kategorii" });

    await user.click(
      screen.getByRole("button", { name: "Zmień nazwę kategorii: Jedzenie" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Usuń kategorię: Jedzenie" }),
    );
    expect(
      await screen.findByText(/zostanie trwale usunięta/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń kategorię" }));

    expect(await screen.findByText("Brak kategorii.")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/v1/categories/1/",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  test("user can pick a suggested icon for a new category", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(
        jsonResponse({ id: 9, name: "Kawa", icon: "coffee" }, 201),
      );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByRole("list", { name: "Lista kategorii" });

    const trigger = screen.getByRole("button", {
      name: "Ikona kategorii: Etykieta",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    const popup = await screen.findByRole("group", { name: "Ikona kategorii" });
    expect(
      within(popup).getByRole("button", { name: "Etykieta" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(popup).getByRole("button", { name: "Kawa" }));

    expect(
      screen.queryByRole("group", { name: "Ikona kategorii" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ikona kategorii: Kawa" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nowa kategoria"), "Kawa");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));

    // The form resets to the default icon for the next category.
    expect(
      await screen.findByRole("button", { name: "Ikona kategorii: Etykieta" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/v1/categories/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Kawa", icon: "coffee" }),
      }),
    );
  });

  test("the icon search reaches every lucide icon, by Polish label or English name", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByRole("list", { name: "Lista kategorii" });
    await user.click(
      screen.getByRole("button", { name: "Ikona kategorii: Etykieta" }),
    );
    const popup = await screen.findByRole("group", { name: "Ikona kategorii" });
    const search = within(popup).getByLabelText("Szukaj ikony");
    expect(search).toHaveFocus();

    // A Polish suggestion label, typed without diacritics.
    await user.type(search, "zwierzeta");
    expect(
      within(popup).getByRole("button", { name: "Zwierzęta" }),
    ).toBeInTheDocument();

    // An icon outside the suggestions, by its lucide name.
    await user.clear(search);
    await user.type(search, "rocket");
    expect(
      within(popup).getByRole("button", { name: "rocket" }),
    ).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "qqqq");
    expect(
      within(popup).getByText("Brak ikon dla „qqqq”."),
    ).toBeInTheDocument();
  });

  test("Enter in the icon search takes the first hit without submitting the form", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByRole("list", { name: "Lista kategorii" });
    await user.type(screen.getByLabelText("Nowa kategoria"), "Rakiety");
    await user.click(
      screen.getByRole("button", { name: "Ikona kategorii: Etykieta" }),
    );
    await user.type(
      await screen.findByLabelText("Szukaj ikony"),
      "rocket{Enter}",
    );

    expect(
      screen.getByRole("button", { name: "Ikona kategorii: rocket" }),
    ).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("user can change a category icon while editing", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories)
      .mockResolvedValueOnce(jsonResponse({ ...catJedzenie, icon: "rocket" }));
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", {
        name: "Zmień nazwę kategorii: Jedzenie",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Ikona kategorii: Jedzenie" }),
    );
    await user.type(await screen.findByLabelText("Szukaj ikony"), "rocket");
    await user.click(screen.getByRole("button", { name: "rocket" }));
    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/v1/categories/1/",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Jedzenie", icon: "rocket" }),
        }),
      ),
    );
  });

  test("Escape folds the icon popup without cancelling the edit", async () => {
    const initial = mockInitial([catJedzenie]);
    fetchMock
      .mockResolvedValueOnce(initial.wallets)
      .mockResolvedValueOnce(initial.projects)
      .mockResolvedValueOnce(initial.categories);
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", {
        name: "Zmień nazwę kategorii: Jedzenie",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Ikona kategorii: Jedzenie" }),
    );
    await screen.findByLabelText("Szukaj ikony");
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("group", { name: "Ikona kategorii" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ikona kategorii: Jedzenie" }),
    ).toHaveFocus();
    expect(screen.getByLabelText("Nazwa kategorii")).toBeInTheDocument();
  });
});
