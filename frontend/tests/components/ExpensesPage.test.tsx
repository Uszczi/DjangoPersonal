/** User-visible Wallet flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ALL_WALLETS,
  useWalletSelectionStore,
} from "@personal/shared/stores/walletSelection";

import { renderApp } from "../renderApp";
import { uid } from "../ids";

const inbox = { id: uid(1), name: "Inbox", description: "", is_inbox: true };

// API returns snake_case; the generated client maps it to camelCase.
const personalWalletApi = {
  id: uid(1),
  name: "Personal",
  color: "#477c7c",
  transaction_count: 0,
  balance: "0.00",
};

const businessWalletApi = {
  id: uid(2),
  name: "Business",
  color: "#d45b3e",
  transaction_count: 3,
  balance: "120.00",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Route mocks by URL so tests do not depend on fetch call order. */
function routeByUrl({
  wallets = [personalWalletApi],
  written,
  walletsStatus = 200,
  transactions = () => [],
  categories = [],
}: {
  wallets?: unknown[];
  /** The body answered to a wallet POST/PATCH. */
  written?: unknown;
  walletsStatus?: number;
  /** The transaction list, asked for on every request (so it can change mid-test); gets the request URL. */
  transactions?: (url: string) => unknown[];
  categories?: unknown[];
} = {}) {
  return (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    if (path.includes("/wallets/")) {
      if (init?.method === "POST")
        return Promise.resolve(jsonResponse(written ?? {}, 201));
      if (init?.method === "PATCH")
        return Promise.resolve(jsonResponse(written ?? {}));
      if (init?.method === "DELETE")
        return Promise.resolve(jsonResponse(null, 204));
      return Promise.resolve(
        jsonResponse(
          walletsStatus === 200 ? wallets : { detail: "Server error" },
          walletsStatus,
        ),
      );
    }
    if (path.includes("/projects/"))
      return Promise.resolve(jsonResponse([inbox]));
    if (path.includes("/transactions/")) {
      return Promise.resolve(
        jsonResponse({ items: transactions(path), next_cursor: null }),
      );
    }
    if (path.includes("/categories/"))
      return Promise.resolve(jsonResponse(categories));
    return Promise.resolve(jsonResponse({ detail: "Not found" }, 404));
  };
}

/** The wallet list: one link per wallet (name, count, balance), the shown one marked current. */
function switcher() {
  return screen.getByRole("navigation", { name: "Wybierz portfel" });
}

describe("Wallets", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("the expenses page shows the first wallet when none is selected yet", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    );

    renderApp("/expenses");

    expect(
      await screen.findByRole("region", { name: "Portfel: Business" }),
    ).toBeInTheDocument();
    expect(
      within(switcher()).getByRole("link", { name: /^Business/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("list", { name: "Portfele" }),
    ).not.toBeInTheDocument();
  });

  test("the expenses page shows the wallet selected in the store", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    );
    const user = userEvent.setup();

    const { router } = renderApp("/expenses");
    await screen.findByRole("region", { name: "Portfel: Business" });

    await user.click(
      within(switcher()).getByRole("link", { name: /^Personal/ }),
    );
    await screen.findByRole("region", { name: "Portfel: Personal" });
    expect(useWalletSelectionStore.getState().selectedWalletId).toBe(uid(1));

    await router.navigate({ to: "/expenses" });
    expect(
      await screen.findByRole("region", { name: "Portfel: Personal" }),
    ).toBeInTheDocument();
  });

  test("user can drag a wallet to another place in the list", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [businessWalletApi, personalWalletApi],
        written: { ...businessWalletApi, position: 1 },
      }),
    );
    // jsdom has no layout: Business sits at y=0, Personal 100px below.
    const tops: Record<string, number> = { Business: 0, Personal: 100 };
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const label = this.querySelector("[aria-label^='Przeciągnij portfel']")
          ?.getAttribute("aria-label")
          ?.replace("Przeciągnij portfel: ", "");
        const top = label === undefined ? undefined : tops[label];
        return DOMRect.fromRect({
          x: 0,
          y: top ?? 0,
          width: 300,
          height: top === undefined ? 0 : 40,
        });
      });
    const user = userEvent.setup();

    renderApp("/expenses");
    const handle = await screen.findByRole("button", {
      name: "Przeciągnij portfel: Business",
    });
    handle.focus();
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowDown]");
    await user.keyboard("[Space]");
    rect.mockRestore();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/wallets/${uid(2)}/`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ position: 1 }),
        }),
      ),
    );
  });

  test("user can create a wallet and it becomes the shown wallet", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: {
          id: uid(1),
          name: "Personal",
          color: "#477c7c",
          transaction_count: 0,
          balance: "0.00",
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByText("Brak portfeli. Utwórz pierwszy portfel.");

    await user.click(screen.getByRole("button", { name: "Nowy portfel" }));
    await user.type(
      await screen.findByLabelText("Nazwa portfela"),
      "  Personal  ",
    );
    await user.click(screen.getByRole("button", { name: "Utwórz portfel" }));

    expect(
      await screen.findByRole("region", { name: "Portfel: Personal" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/wallets/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Personal", color: "#477c7c" }),
      }),
    );
  });

  test("user can open a wallet with an initial balance", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: {
          id: uid(1),
          name: "Personal",
          color: "#477c7c",
          transaction_count: 1,
          balance: "250.00",
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByText("Brak portfeli. Utwórz pierwszy portfel.");

    await user.click(screen.getByRole("button", { name: "Nowy portfel" }));
    await user.type(await screen.findByLabelText("Nazwa portfela"), "Personal");
    await user.type(screen.getByLabelText("Stan początkowy"), "250");
    await user.click(screen.getByRole("button", { name: "Utwórz portfel" }));

    const shown = await screen.findByRole("region", {
      name: "Portfel: Personal",
    });
    expect(
      within(shown).getByText("Saldo portfela: 250.00"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/wallets/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Personal",
          color: "#477c7c",
          initial_balance: "250",
        }),
      }),
    );
  });

  test("user can set the current balance from the edit modal", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        written: {
          id: uid(1),
          name: "Personal",
          color: "#477c7c",
          transaction_count: 1,
          balance: "75.00",
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    const balanceInput = await screen.findByLabelText("Stan aktualny");
    expect(balanceInput).toHaveValue("0.00");

    await user.clear(balanceInput);
    await user.type(balanceInput, "75");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/wallets/${uid(1)}/`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Personal", current_balance: "75" }),
        }),
      ),
    );
  });

  test("a new balance shows up as a correction transaction straight away", async () => {
    const correctionApi = {
      id: uid(50),
      title: "Korekta stanu",
      amount: "75.00",
      date: "2026-10-24",
      description: "",
      category_id: null,
      wallet_id: uid(1),
      kind: "expense",
    };
    let ledger: unknown[] = [];
    fetchMock.mockImplementation(
      routeByUrl({
        written: {
          ...personalWalletApi,
          transaction_count: 1,
          balance: "75.00",
        },
        transactions: () => ledger,
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    expect(
      await screen.findByText("Brak transakcji w tym miesiącu."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    const balanceInput = await screen.findByLabelText("Stan aktualny");
    await user.clear(balanceInput);
    await user.type(balanceInput, "75");
    // The server writes the correction while handling the PATCH.
    ledger = [correctionApi];
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await screen.findByText("Korekta stanu")).toBeInTheDocument();
  });

  test("a plain rename does not reload the transactions", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ written: { ...personalWalletApi, name: "Renamed" } }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await screen.findByText("Brak transakcji w tym miesiącu.");
    const transactionLoads = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/transactions/"),
      ).length;
    const before = transactionLoads();

    await user.clear(await screen.findByLabelText("Nazwa portfela"));
    await user.type(screen.getByLabelText("Nazwa portfela"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await screen.findByRole("region", { name: "Portfel: Renamed" });
    expect(transactionLoads()).toBe(before);
  });

  test("user can rename a wallet", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        written: {
          id: uid(1),
          name: "Personal renamed",
          color: "#477c7c",
          transaction_count: 0,
          balance: "0.00",
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));

    await user.clear(await screen.findByLabelText("Nazwa portfela"));
    await user.type(
      screen.getByLabelText("Nazwa portfela"),
      "Personal renamed",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(
      await screen.findByRole("region", { name: "Portfel: Personal renamed" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/wallets/${uid(1)}/`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Personal renamed" }),
      }),
    );
  });

  test("user can pick a colour for a new wallet", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: {
          id: uid(1),
          name: "Personal",
          color: "#3d6fb6",
          transaction_count: 0,
          balance: "0.00",
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByText("Brak portfeli. Utwórz pierwszy portfel.");

    await user.click(screen.getByRole("button", { name: "Nowy portfel" }));
    await user.type(await screen.findByLabelText("Nazwa portfela"), "Personal");
    expect(screen.getByRole("radio", { name: "Morski" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Niebieski" }));
    await user.click(screen.getByRole("button", { name: "Utwórz portfel" }));

    await screen.findByRole("region", { name: "Portfel: Personal" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/wallets/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Personal", color: "#3d6fb6" }),
      }),
    );
  });

  test("user can change a wallet colour", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ written: { ...personalWalletApi, color: "#4f8a3c" } }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    expect(await screen.findByRole("radio", { name: "Morski" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Zielony" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/wallets/${uid(1)}/`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Personal", color: "#4f8a3c" }),
        }),
      ),
    );
  });

  test("deleting the shown wallet falls back to the next one", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [businessWalletApi, personalWalletApi] }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Business" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );

    expect(
      await screen.findByText(/zostanie trwale usunięty/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń portfel" }));

    expect(
      await screen.findByRole("region", { name: "Portfel: Personal" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/wallets/${uid(2)}/`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("deleting the last wallet leaves the empty state", async () => {
    fetchMock.mockImplementation(routeByUrl());
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Usuń portfel" }),
    );

    expect(
      await screen.findByText("Brak portfeli. Utwórz pierwszy portfel."),
    ).toBeInTheDocument();
  });

  test("user can give a new wallet an optional icon", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [],
        written: { ...personalWalletApi, icon: "piggy-bank" },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await screen.findByText("Brak portfeli. Utwórz pierwszy portfel.");

    await user.click(screen.getByRole("button", { name: "Nowy portfel" }));
    await user.type(await screen.findByLabelText("Nazwa portfela"), "Personal");
    await user.click(
      screen.getByRole("button", { name: "Ikona portfela: Bez ikony" }),
    );
    const popup = await screen.findByRole("group", { name: "Ikona portfela" });
    expect(
      within(popup).getByRole("button", { name: "Bez ikony" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(popup).getByRole("button", { name: "Oszczędności" }),
    );
    await user.click(screen.getByRole("button", { name: "Utwórz portfel" }));

    await screen.findByRole("region", { name: "Portfel: Personal" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/wallets/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Personal",
          color: "#477c7c",
          icon: "piggy-bank",
        }),
      }),
    );
    // The icon stands in for the colour dot next to the wallet's name.
    await waitFor(() =>
      expect(switcher().querySelector("svg.lucide-piggy-bank")).not.toBeNull(),
    );
  });

  test("user can remove a wallet icon", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [{ ...personalWalletApi, icon: "piggy-bank" }],
        written: { ...personalWalletApi, icon: null },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj portfel: Personal" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Ikona portfela: Oszczędności",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Bez ikony" }));
    expect(
      screen.getByRole("button", { name: "Ikona portfela: Bez ikony" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/wallets/${uid(1)}/`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "Personal", icon: null }),
        }),
      ),
    );
  });

  test("the wallet switcher lists every wallet and opens the chosen one", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ wallets: [personalWalletApi, businessWalletApi] }),
    );
    const user = userEvent.setup();

    const { router } = renderApp("/expenses");
    await screen.findByRole("region", { name: "Portfel: Personal" });

    const links = within(switcher()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringMatching(/^Wszystkie/),
      expect.stringMatching(/^Personal/),
      expect.stringMatching(/^Business/),
    ]);
    await user.click(
      within(switcher()).getByRole("link", { name: /^Business/ }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/expenses/${uid(2)}`),
    );
    expect(
      await screen.findByRole("region", { name: "Portfel: Business" }),
    ).toBeInTheDocument();
  });

  test("the expenses page shows an error on load failure", async () => {
    fetchMock.mockImplementation(routeByUrl({ walletsStatus: 500 }));

    renderApp("/expenses");

    expect(
      await screen.findByText(/Nie udało się wczytać portfeli/),
    ).toBeInTheDocument();
  });

  test("unknown wallet URL redirects to the expenses page", async () => {
    fetchMock.mockImplementation(routeByUrl({ wallets: [] }));

    const { router } = renderApp(`/expenses/${uid(9999)}`);

    expect(
      await screen.findByText("Brak portfeli. Utwórz pierwszy portfel."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/expenses"),
    );
  });
});

describe("The wallet's month", () => {
  const fetchMock = vi.fn();

  const food = {
    id: uid(7),
    name: "Jedzenie",
    icon: "utensils",
    is_system: false,
    kind: "expense",
  };
  const salary = {
    id: uid(8),
    name: "Wynagrodzenie",
    icon: "banknote",
    is_system: false,
    kind: "income",
  };

  function transaction(
    id: string,
    title: string,
    amount: string,
    date: string,
    category: typeof food | null,
  ) {
    return {
      id,
      title,
      amount,
      date,
      description: "",
      category_id: category?.id ?? null,
      wallet_id: uid(1),
      kind: category?.kind ?? "expense",
    };
  }

  const october = [
    transaction(uid(3), "Pensja", "5000.00", "2026-10-24", salary),
    transaction(uid(2), "Obiad", "40.10", "2026-10-24", food),
    transaction(uid(1), "Bilet", "9.90", "2026-10-02", null),
  ];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(
      routeByUrl({ transactions: () => october, categories: [food, salary] }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function transactionList() {
    return screen.getByRole("list", { name: "Transakcje miesiąca" });
  }

  test("the month from the address is loaded and summed up", async () => {
    renderApp("/expenses?month=2026-10");

    expect(await screen.findByText("Październik 2026")).toBeInTheDocument();
    await screen.findByText("Obiad");
    expect(
      within(screen.getByRole("region", { name: "Wydatki" })).getByText(
        "50,00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Przychody" })).getByText(
        "5000,00",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Bilans" })).getByText(
        "+4950,00",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("date_from=2026-10-01&date_to=2026-10-31"),
      expect.anything(),
    );
    const breakdown = screen.getByRole("region", { name: "Na co poszło" });
    expect(
      within(breakdown)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Jedzenie: 40,10 zł", "Bez kategorii: 9,90 zł"]);
  });

  test("the arrows move to another month and keep it in the address", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/expenses?month=2026-10");
    await screen.findByText("Październik 2026");

    await user.click(screen.getByRole("button", { name: "Poprzedni miesiąc" }));

    expect(await screen.findByText("Wrzesień 2026")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ month: "2026-09" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("date_from=2026-09-01&date_to=2026-09-30"),
      expect.anything(),
    );
  });

  test("a day in the calendar narrows the list until its filter is removed", async () => {
    const user = userEvent.setup();
    renderApp("/expenses?month=2026-10");
    await screen.findByText("Obiad");

    await user.click(
      screen.getByRole("button", { name: "24 października: wydano 40,10 zł" }),
    );

    expect(within(transactionList()).queryByText("Bilet")).toBeNull();
    expect(within(transactionList()).getByText("Pensja")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Usuń filtr: 24 paź" }),
    );
    expect(within(transactionList()).getByText("Bilet")).toBeInTheDocument();
  });

  test("a category in Na co poszło narrows the list to its Expenses", async () => {
    const user = userEvent.setup();
    renderApp("/expenses?month=2026-10");
    await screen.findByText("Obiad");

    await user.click(
      screen.getByRole("button", { name: "Bez kategorii: 9,90 zł" }),
    );

    const titles = within(transactionList())
      .getAllByRole("button")
      .map((row) => row.getAttribute("aria-label"));
    expect(titles).toEqual(["Edytuj transakcję: Bilet"]);
  });
});

describe("Every wallet together", () => {
  const fetchMock = vi.fn();

  function transaction(
    id: string,
    title: string,
    amount: string,
    walletId: string,
  ) {
    return {
      id,
      title,
      amount,
      date: "2026-10-24",
      description: "",
      category_id: null,
      wallet_id: walletId,
      kind: "expense",
    };
  }

  /** Each wallet's October, answered by the `wallet=` the request asks for. */
  function byWallet(url: string) {
    const wallet = new URL(url, "http://localhost").searchParams.get("wallet");
    if (!url.includes("date_from=2026-10")) return [];
    if (wallet === uid(1))
      return [transaction(uid(11), "Obiad", "40.00", uid(1))];
    if (wallet === uid(2))
      return [transaction(uid(12), "Serwer", "60.50", uid(2))];
    return [];
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(
      routeByUrl({
        wallets: [personalWalletApi, businessWalletApi],
        transactions: byWallet,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("Wszystkie adds up every wallet's month and lists their transactions", async () => {
    const user = userEvent.setup();

    const { router } = renderApp("/expenses?month=2026-10");
    await screen.findByRole("region", { name: "Portfel: Personal" });
    await user.click(
      within(switcher()).getByRole("link", { name: /^Wszystkie/ }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/expenses/all"),
    );
    const shown = await screen.findByRole("region", {
      name: "Wszystkie portfele",
    });
    expect(
      within(switcher()).getByRole("link", { name: /^Wszystkie/ }),
    ).toHaveAttribute("aria-current", "page");
    await waitFor(() =>
      expect(
        within(shown).getByRole("region", { name: "Wydatki" }),
      ).toHaveTextContent("100,50"),
    );
    expect(
      within(shown).getByText("Saldo portfeli: 120.00"),
    ).toBeInTheDocument();
    const rows = within(
      await within(shown).findByRole("list", { name: "Transakcje miesiąca" }),
    ).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Serwer.*Business/),
      expect.stringMatching(/Obiad.*Personal/),
    ]);
    expect(
      within(shown).queryByRole("button", { name: /^Edytuj portfel/ }),
    ).not.toBeInTheDocument();
    expect(useWalletSelectionStore.getState().selectedWalletId).toBe(
      ALL_WALLETS,
    );
  });

  test("the expenses page reopens Wszystkie when it was the last choice", async () => {
    const { router } = renderApp("/expenses/all?month=2026-10");
    await screen.findByRole("region", { name: "Wszystkie portfele" });

    await router.navigate({ to: "/projects" });
    await router.navigate({ to: "/expenses" });

    expect(
      await screen.findByRole("region", { name: "Wszystkie portfele" }),
    ).toBeInTheDocument();
  });
});
