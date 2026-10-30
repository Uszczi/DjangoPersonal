/** User-visible Transaction flow tests, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

// API returns snake_case; the generated client maps it to camelCase.
const personalWalletApi = {
  id: 1,
  name: "Personal",
  color: "#477c7c",
  transaction_count: 2,
  balance: "-53.99",
};

const categoriesApi = [
  { id: 5, name: "Jedzenie", icon: "utensils", kind: "expense" },
];

const coffeeTransactionApi = {
  id: 10,
  title: "Kawa",
  amount: "8.00",
  date: "2026-10-16",
  description: "Na rynku",
  category_id: 5,
  wallet_id: 1,
  kind: "expense",
};

const lunchTransactionApi = {
  id: 11,
  title: "Obiad",
  amount: "45.99",
  date: "2026-10-18",
  description: "",
  category_id: null,
  wallet_id: 1,
  kind: "expense",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type TransactionPageApi = { items: unknown[]; next_cursor: string | null };

/** Route mocks by URL so tests do not depend on fetch call order. */
function routeByUrl({
  transactions = [coffeeTransactionApi, lunchTransactionApi],
  pages,
  created,
  patched,
  categories = categoriesApi,
  wallet = () => personalWalletApi,
}: {
  /** A wallet whose transactions fit on one page. */
  transactions?: unknown[];
  /** The pages of a longer list, by the `cursor` asked for ("" for the first page). */
  pages?: Record<string, TransactionPageApi>;
  created?: unknown;
  patched?: unknown;
  categories?: unknown[];
  /** The wallet as the server has it now, asked for on every request. */
  wallet?: () => unknown;
} = {}) {
  return (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    if (path.includes("/transactions/")) {
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(created ?? {}, 201));
      }
      if (init?.method === "PATCH") {
        return Promise.resolve(jsonResponse(patched ?? {}));
      }
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      if (pages) {
        const cursor =
          new URL(path, "http://test").searchParams.get("cursor") ?? "";
        return Promise.resolve(jsonResponse(pages[cursor]));
      }
      return Promise.resolve(
        jsonResponse({ items: transactions, next_cursor: null }),
      );
    }
    if (path.includes("/categories/")) {
      return Promise.resolve(jsonResponse(categories));
    }
    if (/\/wallets\/\d+\/$/.test(path)) {
      return Promise.resolve(jsonResponse(wallet()));
    }
    if (path.includes("/wallets/")) {
      return Promise.resolve(jsonResponse([wallet()]));
    }
    if (path.includes("/projects/")) {
      return Promise.resolve(
        jsonResponse([
          { id: 1, name: "Inbox", description: "", is_inbox: true },
        ]),
      );
    }
    return Promise.resolve(jsonResponse({ detail: "Not found" }, 404));
  };
}

describe("Transactions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("transaction list is grouped by date with category and description", async () => {
    fetchMock.mockImplementation(routeByUrl());

    renderApp("/expenses/1");

    const firstDay = await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });
    expect(within(firstDay).getByText("Kawa")).toBeInTheDocument();
    expect(within(firstDay).getByText("−8.00")).toBeInTheDocument();
    expect(within(firstDay).getByText("Na rynku")).toBeInTheDocument();
    expect(within(firstDay).getByText("Jedzenie")).toBeInTheDocument();
    // The category's icon is decorative (and loads lazily), so it is found by lucide's class name.
    await waitFor(() =>
      expect(firstDay.querySelector("svg.lucide-utensils")).not.toBeNull(),
    );

    const secondDay = screen.getByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });
    expect(within(secondDay).getByText("Obiad")).toBeInTheDocument();
    expect(within(secondDay).getByText("−45.99")).toBeInTheDocument();
  });

  test("amounts carry the sign and colour of their kind", async () => {
    const expenseApi = {
      ...coffeeTransactionApi,
      date: "2026-10-17",
    };
    const incomeApi = {
      id: 20,
      title: "Wynagrodzenie",
      amount: "500.00",
      date: "2026-10-17",
      description: "",
      category_id: 6,
      wallet_id: 1,
      kind: "income",
    };
    const systemApi = {
      id: 21,
      title: "Stan początkowy",
      amount: "100.00",
      date: "2026-10-17",
      description: "",
      category_id: 9,
      wallet_id: 1,
      kind: null,
    };
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [incomeApi, expenseApi, systemApi],
        categories: [
          ...categoriesApi,
          { id: 6, name: "Wynagrodzenie", icon: "banknote", kind: "income" },
          { id: 9, name: "System", is_system: true, kind: null },
        ],
      }),
    );

    renderApp("/expenses/1");
    const day = await screen.findByRole("list", {
      name: "Transakcje z dnia 17 października 2026",
    });

    expect(within(day).getByText("+500.00")).toHaveClass("text-income");
    expect(within(day).getByText("−8.00")).toHaveClass("text-expense");
    expect(within(day).getByText("+100.00")).toHaveClass("text-muted");
    expect(within(day).getByText("Wpis systemowy")).toBeInTheDocument();
  });

  test("user can add a transaction via a modal", async () => {
    const createdApi = {
      id: 12,
      title: "Książka",
      amount: "34.90",
      date: "2026-10-18",
      description: "Księgarnia",
      category_id: 5,
      wallet_id: 1,
      kind: "expense",
    };
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [lunchTransactionApi],
        created: createdApi,
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));
    await user.type(await screen.findByLabelText("Tytuł"), "Książka");
    await user.type(screen.getByLabelText("Kwota"), "34.90");
    await user.clear(screen.getByLabelText("Data"));
    await user.type(screen.getByLabelText("Data"), "2026-10-18");
    await user.type(screen.getByLabelText("Opis"), "Księgarnia");
    await user.selectOptions(screen.getByLabelText("Kategoria"), "5");
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));

    const secondDay = await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });
    expect(within(secondDay).getByText("Książka")).toBeInTheDocument();
    expect(within(secondDay).getByText("−34.90")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/transactions/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Książka",
          amount: "34.90",
          date: "2026-10-18",
          description: "Księgarnia",
          category: 5,
          wallet: 1,
        }),
      }),
    );
  });

  test("an added transaction lands in newest-first order", async () => {
    const createdApi = {
      id: 12,
      title: "Książka",
      amount: "34.90",
      date: "2026-10-18",
      description: "",
      category_id: null,
      wallet_id: 1,
      kind: "expense",
    };
    fetchMock.mockImplementation(
      routeByUrl({
        // The server's order: newest day first.
        transactions: [lunchTransactionApi, coffeeTransactionApi],
        created: createdApi,
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));
    await user.type(await screen.findByLabelText("Tytuł"), "Książka");
    await user.type(screen.getByLabelText("Kwota"), "34.90");
    await user.clear(screen.getByLabelText("Data"));
    await user.type(screen.getByLabelText("Data"), "2026-10-18");
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));

    await screen.findByText("Książka");
    const titles = screen
      .getAllByRole("button", { name: /^Edytuj transakcję: / })
      .map((button) => button.getAttribute("aria-label"));
    expect(titles).toEqual([
      "Edytuj transakcję: Książka",
      "Edytuj transakcję: Obiad",
      "Edytuj transakcję: Kawa",
    ]);
  });

  test("amount must be positive with at most two decimal places", async () => {
    fetchMock.mockImplementation(routeByUrl());
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));

    await user.type(await screen.findByLabelText("Tytuł"), "Zła kwota");
    await user.type(screen.getByLabelText("Kwota"), "12.345");
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kwota może mieć maksymalnie 2 miejsca dziesiętne.",
    );

    await user.clear(screen.getByLabelText("Kwota"));
    await user.type(screen.getByLabelText("Kwota"), "0");
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kwota musi być większa od zera.",
    );

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/transactions/"),
      ),
    ).toHaveLength(1);
  });

  test("an existing transaction opens read-only until the pencil is pressed", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ transactions: [coffeeTransactionApi] }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });
    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );

    expect(await screen.findByLabelText("Tytuł")).toBeDisabled();
    expect(screen.getByLabelText("Tytuł")).toHaveValue("Kawa");
    expect(
      screen.queryByRole("button", { name: "Zapisz zmiany" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usuń" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edytuj" }));

    expect(screen.getByLabelText("Tytuł")).toBeEnabled();
    expect(screen.getByLabelText("Tytuł")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Zapisz zmiany" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edytuj" }),
    ).not.toBeInTheDocument();
  });

  test("a new transaction opens editable, without the pencil", async () => {
    fetchMock.mockImplementation(routeByUrl());
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await user.click(
      await screen.findByRole("button", { name: "Nowa transakcja" }),
    );

    expect(await screen.findByLabelText("Tytuł")).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Edytuj" }),
    ).not.toBeInTheDocument();
  });

  test("user can edit a transaction via a modal", async () => {
    const patchedApi = { ...coffeeTransactionApi, title: "Kawa specjalna" };
    fetchMock.mockImplementation(
      routeByUrl({ transactions: [coffeeTransactionApi], patched: patchedApi }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    const day = await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });

    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));

    const titleInput = await screen.findByLabelText("Tytuł");
    expect(titleInput).toHaveValue("Kawa");
    await user.clear(titleInput);
    await user.type(titleInput, "Kawa specjalna");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await within(day).findByText("Kawa specjalna")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/transactions/10/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          title: "Kawa specjalna",
          amount: "8.00",
          date: "2026-10-16",
          description: "Na rynku",
          category: 5,
          wallet: 1,
        }),
      }),
    );
  });

  test("a transaction description can span several lines", async () => {
    const patchedApi = {
      ...coffeeTransactionApi,
      description: "Na rynku\nz Anią",
    };
    fetchMock.mockImplementation(
      routeByUrl({ transactions: [coffeeTransactionApi], patched: patchedApi }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });
    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));

    const description = screen.getByLabelText("Opis");
    expect(description.tagName).toBe("TEXTAREA");
    await user.type(description, "{Enter}z Anią");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/transactions/10/",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"description":"Na rynku\\nz Anią"'),
        }),
      ),
    );
    // The list keeps the line break instead of folding the text into one line.
    const shown = await screen.findByText(
      (_, element) => element?.textContent === "Na rynku\nz Anią",
    );
    expect(shown).toHaveClass("whitespace-pre-line");
  });

  test("the System category is not offered for a new transaction", async () => {
    fetchMock.mockImplementation(
      routeByUrl({
        categories: [
          ...categoriesApi,
          { id: 9, name: "System", is_system: true, kind: null },
        ],
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));
    const select = await screen.findByLabelText("Kategoria");

    expect(
      within(select).queryByRole("option", { name: "System" }),
    ).not.toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Jedzenie" }),
    ).toBeInTheDocument();
  });

  test("the picker groups Wydatki and Przychody and the labels follow the kind", async () => {
    const incomeCategory = {
      id: 6,
      name: "Wynagrodzenie",
      icon: "banknote",
      kind: "income",
    };
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [lunchTransactionApi],
        categories: [...categoriesApi, incomeCategory],
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));

    const wydatki = await screen.findByRole("group", { name: "Wydatki" });
    expect(
      within(wydatki).getByRole("option", { name: "Jedzenie" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Przychody" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Bez kategorii (wydatek)" }),
    ).toBeInTheDocument();

    // Choosing an Income category flips the kicker, title and submit button.
    await user.selectOptions(screen.getByLabelText("Kategoria"), "6");
    expect(screen.getByText("NOWY PRZYCHÓD")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nowy przychód" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Dodaj przychód",
      }),
    ).toBeInTheDocument();
  });

  test("a System entry opens read-only with only Usuń and Zamknij", async () => {
    const correction = {
      id: 12,
      title: "Korekta stanu",
      amount: "-20.00",
      date: "2026-10-18",
      description: "",
      category_id: 9,
      wallet_id: 1,
      kind: null,
    };
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [correction],
        categories: [
          ...categoriesApi,
          { id: 9, name: "System", is_system: true, kind: null },
        ],
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 18 października 2026",
    });

    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Korekta stanu" }),
    );

    expect(
      await screen.findByText(/Ten wpis zapisał system/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tytuł")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Edytuj" })).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Usuń" }),
    ).toBeInTheDocument();
    // The footer's Zamknij joins the modal's own close (×) button.
    expect(
      within(dialog).getAllByRole("button", { name: "Zamknij" }),
    ).toHaveLength(2);
  });

  test("user can delete a transaction after confirming", async () => {
    fetchMock.mockImplementation(
      routeByUrl({ transactions: [coffeeTransactionApi] }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByRole("list", {
      name: "Transakcje z dnia 16 października 2026",
    });

    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );

    expect(
      await screen.findByText(/zostanie trwale usunięta/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń transakcję" }));

    expect(
      await screen.findByText("Brak transakcji. Dodaj pierwszą transakcję."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/transactions/10/",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("the wallet balance follows an added transaction", async () => {
    let balance = "-45.99";
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [lunchTransactionApi],
        created: { ...coffeeTransactionApi, id: 12 },
        wallet: () => ({ ...personalWalletApi, balance }),
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    const header = await screen.findByRole("button", {
      name: "Edytuj portfel: Personal",
    });
    expect(header).toHaveTextContent("-45.99");

    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));
    await user.type(await screen.findByLabelText("Tytuł"), "Kawa");
    await user.type(screen.getByLabelText("Kwota"), "8.00");
    // The server's balance moves once it has stored the transaction.
    balance = "-53.99";
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));

    await waitFor(() => expect(header).toHaveTextContent("-53.99"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/wallets/1/",
      expect.anything(),
    );
  });

  test("the wallet balance follows a deleted transaction", async () => {
    let balance = "-8.00";
    fetchMock.mockImplementation(
      routeByUrl({
        transactions: [coffeeTransactionApi],
        wallet: () => ({ ...personalWalletApi, balance }),
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    const header = await screen.findByRole("button", {
      name: "Edytuj portfel: Personal",
    });
    expect(header).toHaveTextContent("-8.00");

    await user.click(
      await screen.findByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );
    balance = "0.00";
    await user.click(
      await screen.findByRole("button", { name: "Usuń transakcję" }),
    );

    await waitFor(() => expect(header).toHaveTextContent("0.00"));
  });
  test("a long list shows the first page and loads the next one on request", async () => {
    const firstPage = Array.from({ length: 50 }, (_, n) => ({
      ...lunchTransactionApi,
      id: 1000 - n,
      title: `Zakup ${n + 1}`,
    }));
    fetchMock.mockImplementation(
      routeByUrl({
        pages: {
          "": { items: firstPage, next_cursor: "page-2" },
          "page-2": { items: [coffeeTransactionApi], next_cursor: null },
        },
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");

    await screen.findByText("Zakup 50");
    expect(
      screen.getAllByRole("button", { name: /^Edytuj transakcję: / }),
    ).toHaveLength(50);
    expect(screen.queryByText("Kawa")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wczytaj więcej" }));

    expect(await screen.findByText("Kawa")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Edytuj transakcję: / }),
    ).toHaveLength(51);
    expect(
      screen.queryByRole("button", { name: "Wczytaj więcej" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/transactions/?wallet=1&cursor=page-2",
      expect.anything(),
    );
  });

  test("scrolling to the end of the list loads the next page", async () => {
    let reachEnd: (() => void) | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          reachEnd = () =>
            callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
        }
        observe() {}
        disconnect() {}
      },
    );
    fetchMock.mockImplementation(
      routeByUrl({
        pages: {
          "": { items: [lunchTransactionApi], next_cursor: "page-2" },
          "page-2": { items: [coffeeTransactionApi], next_cursor: null },
        },
      }),
    );

    renderApp("/expenses/1");
    await screen.findByText("Obiad");
    await waitFor(() => expect(reachEnd).toBeDefined());

    reachEnd?.();

    expect(await screen.findByText("Kawa")).toBeInTheDocument();
  });

  test("short pages keep loading while the end of the list stays in view", async () => {
    // Like the real observer: observing reports the element's current
    // visibility at once, and the end of a short list is always visible.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
        observe() {
          queueMicrotask(() =>
            this.callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            ),
          );
        }
        disconnect() {}
      },
    );
    const dinnerApi = {
      ...coffeeTransactionApi,
      id: 9,
      title: "Kolacja",
      date: "2026-10-10",
    };
    fetchMock.mockImplementation(
      routeByUrl({
        pages: {
          "": { items: [lunchTransactionApi], next_cursor: "page-2" },
          "page-2": { items: [coffeeTransactionApi], next_cursor: "page-3" },
          "page-3": { items: [dinnerApi], next_cursor: null },
        },
      }),
    );

    renderApp("/expenses/1");

    expect(await screen.findByText("Kolacja")).toBeInTheDocument();
  });

  test("a new transaction older than every loaded one waits for its page", async () => {
    const olderApi = {
      ...coffeeTransactionApi,
      id: 12,
      title: "Stary paragon",
      date: "2026-01-02",
    };
    fetchMock.mockImplementation(
      routeByUrl({
        pages: { "": { items: [lunchTransactionApi], next_cursor: "page-2" } },
        created: olderApi,
      }),
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByText("Obiad");
    await user.click(screen.getByRole("button", { name: "Nowa transakcja" }));
    await user.type(await screen.findByLabelText("Tytuł"), "Stary paragon");
    await user.type(screen.getByLabelText("Kwota"), "8.00");
    await user.click(screen.getByRole("button", { name: "Dodaj wydatek" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Stary paragon")).not.toBeInTheDocument();
  });

  test("a transaction moved to another wallet leaves this list", async () => {
    const businessWalletApi = { ...personalWalletApi, id: 2, name: "Business" };
    const movedApi = { ...coffeeTransactionApi, wallet_id: 2 };
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) => {
        if (String(url) === "/api/v1/wallets/") {
          return Promise.resolve(
            jsonResponse([personalWalletApi, businessWalletApi]),
          );
        }
        return routeByUrl({
          transactions: [coffeeTransactionApi],
          patched: movedApi,
        })(url, init);
      },
    );
    const user = userEvent.setup();

    renderApp("/expenses/1");
    await screen.findByText("Kawa");
    await user.click(
      screen.getByRole("button", { name: "Edytuj transakcję: Kawa" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.selectOptions(screen.getByLabelText("Portfel"), "2");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(
      await screen.findByText("Brak transakcji. Dodaj pierwszą transakcję."),
    ).toBeInTheDocument();
  });

  test("a failed load says so", async () => {
    fetchMock.mockImplementation(
      (url: string | URL | Request, init?: RequestInit) =>
        String(url).includes("/transactions/")
          ? Promise.resolve(jsonResponse({ detail: "Server error" }, 500))
          : routeByUrl()(url, init),
    );

    renderApp("/expenses/1");

    expect(
      await screen.findByText(
        "Nie udało się wczytać transakcji. Spróbuj ponownie.",
      ),
    ).toBeInTheDocument();
  });
});
