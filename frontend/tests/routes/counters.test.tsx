/** User-visible Counter flow tests, against a small in-memory fake of the counters API. */

import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

type Counter = {
  id: number;
  name: string;
  created_at: string;
  /** What the server would count from the entry days; set per test. */
  streak_days?: number;
  days_since_last_entry?: number | null;
};
type Entry = {
  id: number;
  counter_id: number;
  value: number;
  occurred_at: string;
  note: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Answers the counters endpoints the way the backend does: totals computed from entries,
 * counters listed latest entry added first (`counters` is kept in that order).
 */
function fakeBackend(
  initial: { counters?: Counter[]; entries?: Entry[] } = {},
) {
  const counters = [...(initial.counters ?? [])];
  let entries = [...(initial.entries ?? [])];
  let nextId = 100;

  function withTotals(counter: Counter) {
    const own = entries.filter((entry) => entry.counter_id === counter.id);
    return {
      ...counter,
      entry_count: own.length,
      total: own.reduce((sum, entry) => sum + entry.value, 0),
      streak_days: counter.streak_days ?? 0,
      days_since_last_entry: counter.days_since_last_entry ?? null,
    };
  }

  return async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    // The counter endpoints take the caller's time zone as `?tz=`.
    const bare = path.split("?")[0];
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path.includes("/projects/")) return jsonResponse([]);

    const counterMatch = bare.match(/\/counters\/(\d+)\/$/);
    if (bare.endsWith("/counters/")) {
      if (method === "POST") {
        const counter = {
          id: nextId++,
          name: body.name,
          created_at: "2026-10-24T10:00:00Z",
        };
        counters.unshift(counter);
        return jsonResponse(withTotals(counter), 201);
      }
      return jsonResponse(counters.map(withTotals));
    }
    if (counterMatch) {
      const id = Number(counterMatch[1]);
      const counter = counters.find((item) => item.id === id);
      if (!counter) return jsonResponse({ detail: "Counter not found." }, 404);
      if (method === "DELETE") {
        counters.splice(counters.indexOf(counter), 1);
        entries = entries.filter((entry) => entry.counter_id !== id);
        return jsonResponse(null, 204);
      }
      if (method === "PATCH") Object.assign(counter, body);
      return jsonResponse(withTotals(counter));
    }

    const entryMatch = path.match(/\/counter-entries\/(\d+)\/$/);
    if (path.includes("/counter-entries/?counter=")) {
      const id = Number(new URL(path, "http://x").searchParams.get("counter"));
      return jsonResponse(
        entries
          .filter((entry) => entry.counter_id === id)
          .sort(
            (a, b) =>
              Date.parse(b.occurred_at) - Date.parse(a.occurred_at) ||
              b.id - a.id,
          ),
      );
    }
    if (path.endsWith("/counter-entries/") && method === "POST") {
      const entry = {
        id: nextId++,
        counter_id: body.counter,
        value: body.value ?? 1,
        occurred_at: body.occurred_at,
        note: body.note ?? "",
      };
      entries.push(entry);
      const counter = counters.find((item) => item.id === entry.counter_id);
      if (counter)
        counters.unshift(...counters.splice(counters.indexOf(counter), 1));
      return jsonResponse(entry, 201);
    }
    if (entryMatch) {
      const entry = entries.find((item) => item.id === Number(entryMatch[1]));
      if (!entry)
        return jsonResponse({ detail: "Counter entry not found." }, 404);
      if (method === "DELETE") {
        entries = entries.filter((item) => item !== entry);
        return jsonResponse(null, 204);
      }
      if (method === "PATCH") Object.assign(entry, body);
      return jsonResponse(entry);
    }
    return jsonResponse({ detail: "Not found" }, 404);
  };
}

const coffee = { id: 1, name: "Kawa", created_at: "2026-10-01T10:00:00Z" };

describe("Counters", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("user can create a counter and lands on its page", async () => {
    fetchMock.mockImplementation(fakeBackend());
    const user = userEvent.setup();

    renderApp("/counters");
    await screen.findByText("Utwórz pierwszy licznik");

    await user.click(screen.getByRole("button", { name: "Nowy licznik" }));
    await user.type(await screen.findByLabelText("Nazwa licznika"), "Pompki");
    await user.click(screen.getByRole("button", { name: "Utwórz licznik" }));

    const page = await screen.findByRole("region", { name: "Licznik: Pompki" });
    expect(within(page).getByLabelText("Suma: 0")).toBeInTheDocument();
    expect(
      await screen.findByText("Brak wpisów. Dodaj pierwszy wpis."),
    ).toBeInTheDocument();
  });

  test("the list shows each counter with its total and a quick +1", async () => {
    fetchMock.mockImplementation(
      fakeBackend({
        counters: [coffee],
        entries: [
          {
            id: 10,
            counter_id: 1,
            value: 2,
            occurred_at: "2026-10-20T08:00:00Z",
            note: "",
          },
        ],
      }),
    );
    const user = userEvent.setup();

    renderApp("/counters");
    const list = await screen.findByRole("list", { name: "Liczniki" });
    expect(within(list).getByLabelText("Suma: 2")).toBeInTheDocument();
    expect(within(list).getByText("1 wpis")).toBeInTheDocument();

    await user.click(
      within(list).getByRole("button", { name: "Dodaj 1 do licznika: Kawa" }),
    );

    expect(await within(list).findByLabelText("Suma: 3")).toBeInTheDocument();
    expect(within(list).getByText("2 wpisy")).toBeInTheDocument();
  });

  test("a counter that gets an entry moves to the top of the list", async () => {
    const water = { id: 2, name: "Woda", created_at: "2026-10-02T10:00:00Z" };
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee, water] }));
    const user = userEvent.setup();

    renderApp("/counters");
    const list = await screen.findByRole("list", { name: "Liczniki" });
    const names = () =>
      within(list)
        .getAllByRole("button", { name: /^Dodaj 1 do licznika:/ })
        .map((button) => button.getAttribute("aria-label"));
    expect(names()).toEqual([
      "Dodaj 1 do licznika: Kawa",
      "Dodaj 1 do licznika: Woda",
    ]);

    await user.click(
      within(list).getByRole("button", { name: "Dodaj 1 do licznika: Woda" }),
    );

    await waitFor(() =>
      expect(names()).toEqual([
        "Dodaj 1 do licznika: Woda",
        "Dodaj 1 do licznika: Kawa",
      ]),
    );
  });

  test("user can switch the list to tiles, and the choice is remembered", async () => {
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));
    const user = userEvent.setup();

    renderApp("/counters");
    const views = await screen.findByRole("group", { name: "Widok liczników" });
    expect(
      within(views).getByRole("button", { name: "Wiersze" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(within(views).getByRole("button", { name: "Kafelki" }));

    expect(
      within(views).getByRole("button", { name: "Kafelki" }),
    ).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("list", { name: "Liczniki" });
    expect(within(list).getByLabelText("Suma: 0")).toBeInTheDocument();
    await user.click(
      within(list).getByRole("button", { name: "Dodaj 1 do licznika: Kawa" }),
    );
    expect(await within(list).findByLabelText("Suma: 1")).toBeInTheDocument();
    expect(window.localStorage.getItem("countersView")).toBe("tiles");
  });

  test("tiles show the streak, or the days since the last entry", async () => {
    fetchMock.mockImplementation(
      fakeBackend({
        counters: [
          { ...coffee, streak_days: 3, days_since_last_entry: 0 },
          {
            id: 2,
            name: "Bieganie",
            created_at: "2026-10-01T10:00:00Z",
            days_since_last_entry: 5,
          },
          { id: 3, name: "Woda", created_at: "2026-10-01T10:00:00Z" },
        ],
      }),
    );

    const user = userEvent.setup();

    renderApp("/counters");
    const views = await screen.findByRole("group", { name: "Widok liczników" });
    await user.click(within(views).getByRole("button", { name: "Kafelki" }));
    const list = screen.getByRole("list", { name: "Liczniki" });

    expect(within(list).getByText("3 dni pod rząd")).toBeInTheDocument();
    expect(
      within(list).getByText("5 dni od ostatniego wpisu"),
    ).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")[2]).not.toHaveTextContent(
      /pod rząd|od ostatniego/,
    );
    const listUrl = String(fetchMock.mock.calls[0][0]);
    expect(new URL(listUrl, "http://x").searchParams.get("tz")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  test("user can add, edit and delete entries", async () => {
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));
    const user = userEvent.setup();

    renderApp("/counters/1");
    const page = await screen.findByRole("region", { name: "Licznik: Kawa" });
    await screen.findByText("Brak wpisów. Dodaj pierwszy wpis.");

    // Add.
    await user.click(within(page).getByRole("button", { name: "Nowy wpis" }));
    const value = await screen.findByLabelText("Wartość");
    await user.clear(value);
    await user.type(value, "4");
    // The picker holds local time; jsdom has no picker UI, so set the value directly.
    fireEvent.change(screen.getByLabelText("Kiedy"), {
      target: { value: "2026-10-20T14:30" },
    });
    await user.type(screen.getByLabelText("Notatka"), "espresso");
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));

    const entries = await screen.findByRole("list", { name: "Wpisy" });
    expect(within(entries).getByText("espresso")).toBeInTheDocument();
    expect(
      within(entries).getByText("20 października 2026 14:30"),
    ).toBeInTheDocument();
    const created = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/v1/counter-entries/" && init?.method === "POST",
    );
    expect(JSON.parse(String(created?.[1]?.body)).occurred_at).toBe(
      new Date(2026, 9, 20, 14, 30).toISOString(),
    );
    expect(await within(page).findByLabelText("Suma: 4")).toBeInTheDocument();

    // Edit.
    await user.click(
      within(entries).getByRole("button", {
        name: "Edytuj wpis +4 z 20 października 2026 14:30",
      }),
    );
    const editValue = await screen.findByLabelText("Wartość");
    await user.clear(editValue);
    await user.type(editValue, "-1");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await within(entries).findByText("−1")).toBeInTheDocument();
    expect(await within(page).findByLabelText("Suma: -1")).toBeInTheDocument();

    // Delete.
    await user.click(
      within(entries).getByRole("button", { name: /Edytuj wpis −1/ }),
    );
    await user.click(await screen.findByRole("button", { name: "Usuń" }));
    await user.click(await screen.findByRole("button", { name: "Usuń wpis" }));

    expect(
      await screen.findByText("Brak wpisów. Dodaj pierwszy wpis."),
    ).toBeInTheDocument();
    expect(await within(page).findByLabelText("Suma: 0")).toBeInTheDocument();
  });

  test("the calendar marks the days that have entries and pages through months", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 24, 9, 5));
    fetchMock.mockImplementation(
      fakeBackend({
        counters: [coffee],
        entries: [
          {
            id: 10,
            counter_id: 1,
            value: 1,
            occurred_at: new Date(2026, 9, 20, 8).toISOString(),
            note: "",
          },
          {
            id: 11,
            counter_id: 1,
            value: 1,
            occurred_at: new Date(2026, 9, 20, 18).toISOString(),
            note: "",
          },
          {
            id: 12,
            counter_id: 1,
            value: 1,
            occurred_at: new Date(2026, 8, 3, 12).toISOString(),
            note: "",
          },
        ],
      }),
    );
    const user = userEvent.setup();

    renderApp("/counters/1");
    const calendar = await screen.findByRole("region", {
      name: "Kalendarz wpisów",
    });
    expect(within(calendar).getByText("październik 2026")).toBeInTheDocument();
    expect(
      within(calendar).getByLabelText("20 października: 2 wpisy"),
    ).toHaveAttribute("data-marked", "true");
    expect(
      within(calendar).getByLabelText("21 października: brak wpisów"),
    ).not.toHaveAttribute("data-marked");

    await user.click(
      within(calendar).getByRole("button", { name: "Poprzedni miesiąc" }),
    );

    expect(within(calendar).getByText("wrzesień 2026")).toBeInTheDocument();
    expect(
      within(calendar).getByLabelText("3 września: 1 wpis"),
    ).toHaveAttribute("data-marked", "true");
  });

  test("a new entry defaults to now, and an empty time is refused", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 24, 9, 5));
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));
    const user = userEvent.setup();

    renderApp("/counters/1");
    const page = await screen.findByRole("region", { name: "Licznik: Kawa" });
    await user.click(within(page).getByRole("button", { name: "Nowy wpis" }));
    const when = await screen.findByLabelText("Kiedy");
    expect(when).toHaveValue("2026-10-24T09:05");

    fireEvent.change(when, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));

    expect(
      await screen.findByText("Podaj datę i godzinę."),
    ).toBeInTheDocument();
  });

  test("a zero value is refused before it reaches the server", async () => {
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));
    const user = userEvent.setup();

    renderApp("/counters/1");
    const page = await screen.findByRole("region", { name: "Licznik: Kawa" });
    await user.click(within(page).getByRole("button", { name: "Nowy wpis" }));
    const value = await screen.findByLabelText("Wartość");
    await user.clear(value);
    await user.type(value, "0");
    await user.click(screen.getByRole("button", { name: "Dodaj wpis" }));

    expect(
      await screen.findByText("Wartość nie może być zerem."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/counter-entries/",
      expect.anything(),
    );
  });

  test("user can rename and delete a counter", async () => {
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));
    const user = userEvent.setup();

    const { router } = renderApp("/counters/1");
    await user.click(
      await screen.findByRole("button", { name: "Zmień nazwę licznika: Kawa" }),
    );
    const name = await screen.findByLabelText("Nazwa licznika");
    await user.clear(name);
    await user.type(name, "Herbata");
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    const page = await screen.findByRole("region", {
      name: "Licznik: Herbata",
    });

    await user.click(
      within(page).getByRole("button", { name: "Usuń licznik" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Usunąć licznik?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Usuń licznik" }),
    );

    await screen.findByText("Utwórz pierwszy licznik");
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/counters"),
    );
  });

  test("an unknown counter redirects to the list", async () => {
    fetchMock.mockImplementation(fakeBackend({ counters: [coffee] }));

    const { router } = renderApp("/counters/999");

    await screen.findByRole("list", { name: "Liczniki" });
    expect(router.state.location.pathname).toBe("/counters");
  });
});
