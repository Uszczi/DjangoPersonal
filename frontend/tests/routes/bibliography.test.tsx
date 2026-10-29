/** User-visible Bibliography flow tests, against a small in-memory fake of the BibliographyItems and Attempts API. */

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

type Outcome = "in_progress" | "finished" | "abandoned";

type BibliographyItem = {
  id: number;
  kind: "film" | "book";
  title: string;
  creator: string;
  year: number | null;
  length: number | null;
  note: string;
  status: "planned" | Outcome;
  created_at: string;
};

type Attempt = {
  id: number;
  item_id: number;
  outcome: Outcome;
  started_on: string | null;
  ended_on: string | null;
  progress: number | null;
  created_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The backend's rule, so the fake answers with the status the server would. */
function latestFirst(attempts: Attempt[]) {
  const rank = (p: Attempt) =>
    p.outcome === "in_progress" ? "9999-99-99" : (p.ended_on ?? "");
  return [...attempts].sort(
    (a, b) => rank(b).localeCompare(rank(a)) || b.id - a.id,
  );
}

/** Answers the BibliographyItems and Attempts endpoints the way the backend does. */
function fakeBackend(
  initial: BibliographyItem[] = [],
  initialAttempts: Attempt[] = [],
) {
  const items = initial.map((item) => ({ ...item }));
  const attempts = initialAttempts.map((attempt) => ({ ...attempt }));
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  let nextId = 100;

  function withStatus(item: BibliographyItem): BibliographyItem {
    const latest = latestFirst(
      attempts.filter((p) => p.item_id === item.id),
    )[0];
    return { ...item, status: latest ? latest.outcome : "planned" };
  }

  const handler = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ method, path, body });
    if (path.includes("/projects/")) return jsonResponse([]);

    const listPath = path.match(/\/bibliography-items\/(\?.*)?$/);
    if (listPath) {
      if (method === "POST") {
        const item: BibliographyItem = {
          creator: "",
          year: null,
          length: null,
          note: "",
          ...body,
          id: nextId++,
          title: body.title.trim(),
          status: "planned",
          created_at: "2026-10-29T10:00:00Z",
        };
        items.unshift(item);
        return jsonResponse(item, 201);
      }
      const filters = new URLSearchParams(listPath[1] ?? "");
      const status = filters.get("status");
      const kind = filters.get("kind");
      return jsonResponse(
        items
          .map(withStatus)
          .filter(
            (item) =>
              (!status || item.status === status) &&
              (!kind || item.kind === kind),
          ),
      );
    }
    const itemMatch = path.match(/\/bibliography-items\/(\d+)\/$/);
    if (itemMatch) {
      const item = items.find((item) => item.id === Number(itemMatch[1]));
      if (!item)
        return jsonResponse({ detail: "BibliographyItem not found." }, 404);
      if (method === "DELETE") {
        items.splice(items.indexOf(item), 1);
        for (let i = attempts.length - 1; i >= 0; i--) {
          if (attempts[i].item_id === item.id) attempts.splice(i, 1);
        }
        return new Response(null, { status: 204 });
      }
      if (method === "PATCH") Object.assign(item, body);
      return jsonResponse(withStatus(item));
    }

    if (path.endsWith("/bibliography-attempts/") && method === "GET") {
      return jsonResponse(latestFirst(attempts));
    }
    const listMatch = path.match(/\/bibliography-attempts\/\?item=(\d+)$/);
    if (listMatch) {
      return jsonResponse(
        latestFirst(attempts.filter((p) => p.item_id === Number(listMatch[1]))),
      );
    }
    if (path.endsWith("/bibliography-attempts/") && method === "POST") {
      const attempt: Attempt = {
        id: nextId++,
        item_id: body.item,
        outcome: body.outcome,
        started_on: body.started_on ?? null,
        ended_on: body.ended_on ?? null,
        progress: body.progress ?? null,
        created_at: "2026-10-29T10:00:00Z",
      };
      attempts.push(attempt);
      return jsonResponse(attempt, 201);
    }
    const attemptMatch = path.match(/\/bibliography-attempts\/(\d+)\/$/);
    if (attemptMatch && method === "DELETE") {
      const index = attempts.findIndex(
        (item) => item.id === Number(attemptMatch[1]),
      );
      if (index < 0) return jsonResponse({ detail: "Not found." }, 404);
      attempts.splice(index, 1);
      return new Response(null, { status: 204 });
    }
    if (attemptMatch && method === "PATCH") {
      const attempt = attempts.find(
        (item) => item.id === Number(attemptMatch[1]),
      );
      if (!attempt) return jsonResponse({ detail: "Not found." }, 404);
      Object.assign(attempt, body);
      if (attempt.outcome !== "in_progress") attempt.progress = null;
      return jsonResponse(attempt);
    }
    return jsonResponse({ detail: "Not found" }, 404);
  };
  return { handler, requests };
}

const lalka: BibliographyItem = {
  id: 1,
  kind: "book",
  title: "Lalka",
  creator: "Bolesław Prus",
  year: 1890,
  length: 680,
  note: "",
  status: "planned",
  created_at: "2026-10-01T10:00:00Z",
};

const rejs: BibliographyItem = {
  ...lalka,
  id: 2,
  kind: "film",
  title: "Rejs",
  creator: "",
  year: null,
};

function attempt(fields: Partial<Attempt>): Attempt {
  return {
    id: 50,
    item_id: lalka.id,
    outcome: "finished",
    started_on: null,
    ended_on: "2026-03-01",
    progress: null,
    created_at: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

describe("Bibliography", () => {
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

  test("the Bibliography is reachable from the navigation", async () => {
    fetchMock.mockImplementation(fakeBackend().handler);
    const user = userEvent.setup();

    renderApp("/");
    const nav = await screen.findByRole("navigation", {
      name: "Nawigacja widoków",
    });
    await user.click(within(nav).getByRole("link", { name: "Bibliografia" }));

    expect(
      await screen.findByRole("heading", { name: "Bibliografia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dodaj pierwszą pozycję")).toBeInTheDocument();
  });

  test("the list shows kind, title, creator, year and status", async () => {
    fetchMock.mockImplementation(
      fakeBackend(
        [rejs, lalka],
        [attempt({ item_id: rejs.id, outcome: "in_progress", ended_on: null })],
      ).handler,
    );

    renderApp("/bibliography");
    const list = await screen.findByRole("list", { name: "Pozycje" });
    const [first, second] = within(list).getAllByRole("listitem");

    expect(within(first).getByText("Rejs")).toBeInTheDocument();
    expect(within(first).getByText("Film")).toBeInTheDocument();
    expect(within(first).getByText("W trakcie")).toBeInTheDocument();
    expect(within(second).getByText("Lalka")).toBeInTheDocument();
    expect(within(second).getByText("Książka")).toBeInTheDocument();
    expect(
      within(second).getByText("Bolesław Prus · 1890"),
    ).toBeInTheDocument();
    expect(within(second).getByText("Do przeczytania")).toBeInTheDocument();
  });

  test("the year view lists every Attempt under its year and is remembered", async () => {
    fetchMock.mockImplementation(
      fakeBackend(
        [rejs, lalka],
        [
          attempt({ id: 51, item_id: lalka.id, ended_on: "2025-05-10" }),
          attempt({ id: 52, item_id: lalka.id, ended_on: "2026-02-01" }),
        ],
      ).handler,
    );
    const user = userEvent.setup();

    renderApp("/bibliography");
    await screen.findByRole("list", { name: "Pozycje" });
    const view = screen.getByRole("group", { name: "Widok Bibliografii" });
    await user.click(within(view).getByRole("button", { name: "Lata" }));

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Planowane",
      "2026",
      "2025",
    ]);
    const planned = screen.getByRole("list", { name: "Planowane" });
    expect(within(planned).getByText("Rejs")).toBeInTheDocument();
    for (const [year, day] of [
      ["2026", "01.02.2026"],
      ["2025", "10.05.2025"],
    ]) {
      const list = screen.getByRole("list", { name: year });
      expect(within(list).getByText("Lalka")).toBeInTheDocument();
      expect(
        within(list).getByText(`Bolesław Prus · 1890 · ${day}`),
      ).toBeInTheDocument();
      expect(within(list).getByText("Ukończone")).toBeInTheDocument();
    }
    expect(
      JSON.parse(window.localStorage.getItem("bibliographyView") ?? "{}").state,
    ).toEqual({ mode: "years" });

    await user.type(
      screen.getByRole("searchbox", { name: "Szukaj w Bibliografii" }),
      "Rejs",
    );
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Planowane"]);

    await user.click(within(view).getByRole("button", { name: "Pozycje" }));
    expect(
      await screen.findByRole("list", { name: "Pozycje" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  test("the search finds items fuzzily by title or creator", async () => {
    fetchMock.mockImplementation(fakeBackend([rejs, lalka]).handler);
    const user = userEvent.setup();

    renderApp("/bibliography");
    const list = await screen.findByRole("list", { name: "Pozycje" });
    const search = screen.getByRole("searchbox", {
      name: "Szukaj w Bibliografii",
    });

    await user.type(search, "boleslaw");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Lalka")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "rjs");
    expect(within(list).getByText("Rejs")).toBeInTheDocument();
    expect(within(list).queryByText("Lalka")).not.toBeInTheDocument();

    await user.type(search, "xyz");
    expect(
      screen.getByText("Brak pozycji pasujących do wyszukiwania"),
    ).toBeInTheDocument();

    await user.type(search, "{Escape}");
    expect(
      within(await screen.findByRole("list", { name: "Pozycje" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
  });

  test("user can add a book with only a title", async () => {
    const backend = fakeBackend();
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography");
    await user.click(
      await screen.findByRole("button", { name: "Nowa pozycja" }),
    );
    await user.selectOptions(screen.getByLabelText("Rodzaj"), "book");
    await user.type(screen.getByLabelText("Tytuł"), "Solaris");
    await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));

    const list = await screen.findByRole("list", { name: "Pozycje" });
    expect(within(list).getByText("Solaris")).toBeInTheDocument();
    expect(within(list).getByText("Do przeczytania")).toBeInTheDocument();
    const created = backend.requests.find((r) => r.method === "POST");
    expect(created?.body).toEqual({
      kind: "book",
      title: "Solaris",
      creator: "",
      year: null,
      length: null,
      note: "",
    });
  });

  test("adding without a title shows an error", async () => {
    fetchMock.mockImplementation(fakeBackend().handler);
    const user = userEvent.setup();

    renderApp("/bibliography");
    await user.click(
      await screen.findByRole("button", { name: "Nowa pozycja" }),
    );
    await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));

    expect(await screen.findByText("Podaj tytuł.")).toBeInTheDocument();
  });

  test("a row opens the BibliographyItem's view", async () => {
    fetchMock.mockImplementation(fakeBackend([lalka]).handler);
    const user = userEvent.setup();

    renderApp("/bibliography");
    await user.click(
      await screen.findByRole("button", { name: "Otwórz pozycję: Lalka" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Lalka" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Do przeczytania")).toBeInTheDocument();
    expect(await screen.findByText("Brak podejść")).toBeInTheDocument();
  });

  test("an unknown BibliographyItem leads back to the list", async () => {
    fetchMock.mockImplementation(fakeBackend([lalka]).handler);

    renderApp("/bibliography/999");

    const list = await screen.findByRole("list", { name: "Pozycje" });
    expect(within(list).getByText("Lalka")).toBeInTheDocument();
  });

  test("user can edit a BibliographyItem but not its kind", async () => {
    const backend = fakeBackend([lalka]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj pozycję" }),
    );
    expect(screen.getByLabelText("Rodzaj")).toBeDisabled();
    expect(screen.getByLabelText("Liczba stron")).toHaveValue(680);
    const title = screen.getByLabelText("Tytuł");
    await user.clear(title);
    await user.type(title, "Lalka (wyd. II)");
    await user.clear(screen.getByLabelText("Rok"));
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(
      await screen.findByRole("heading", { name: "Lalka (wyd. II)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bolesław Prus")).toBeInTheDocument();
    const patch = backend.requests.find((r) => r.method === "PATCH");
    expect(patch?.body).not.toHaveProperty("kind");
    expect(patch?.body).toMatchObject({ title: "Lalka (wyd. II)", year: null });
  });

  test("user can start an Attempt and then finish it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
    const backend = fakeBackend([lalka]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(await screen.findByRole("button", { name: "Zacznij" }));
    const startDialog = screen.getByRole("dialog");
    expect(within(startDialog).getByLabelText("Data rozpoczęcia")).toHaveValue(
      "2026-10-20",
    );
    await user.click(
      within(startDialog).getByRole("button", { name: "Zacznij" }),
    );

    const history = await screen.findByRole("list", { name: "Podejścia" });
    expect(await within(history).findByText("W trakcie")).toBeInTheDocument();
    expect(within(history).getByText("od 20.10.2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveTextContent("W trakcie");
    expect(
      screen.queryByRole("button", { name: "Zacznij" }),
    ).not.toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 9, 28, 9, 0));
    await user.click(screen.getByRole("button", { name: "Zakończ" }));
    const finishDialog = screen.getByRole("dialog");
    expect(within(finishDialog).getByLabelText("Data zakończenia")).toHaveValue(
      "2026-10-28",
    );
    await user.click(
      within(finishDialog).getByRole("button", { name: "Zakończ" }),
    );

    expect(await within(history).findByText("Ukończone")).toBeInTheDocument();
    expect(
      within(history).getByText("20.10.2026 – 28.10.2026"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveTextContent("Ukończone");
    const [start, finish] = backend.requests.filter(
      (r) => r.path.includes("/bibliography-attempts/") && r.method !== "GET",
    );
    expect(start.body).toEqual({
      item: 1,
      outcome: "in_progress",
      started_on: "2026-10-20",
      ended_on: null,
    });
    expect(finish.body).toEqual({
      outcome: "finished",
      ended_on: "2026-10-28",
    });
  });

  test("user can abandon an Attempt in progress", async () => {
    fetchMock.mockImplementation(
      fakeBackend(
        [lalka],
        [attempt({ outcome: "in_progress", ended_on: null })],
      ).handler,
    );
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(await screen.findByRole("button", { name: "Porzuć" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Data zakończenia"));
    await user.type(
      within(dialog).getByLabelText("Data zakończenia"),
      "2026-10-05",
    );
    await user.click(within(dialog).getByRole("button", { name: "Porzuć" }));

    const history = screen.getByRole("list", { name: "Podejścia" });
    expect(await within(history).findByText("Porzucone")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveTextContent("Porzucone");
  });

  test("user can record a finished Attempt with only an end date", async () => {
    const backend = fakeBackend([rejs]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/2");
    await user.click(
      await screen.findByRole("button", { name: "Dodaj ukończone" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Data rozpoczęcia")).toHaveValue("");
    await user.clear(within(dialog).getByLabelText("Data zakończenia"));
    await user.type(
      within(dialog).getByLabelText("Data zakończenia"),
      "2026-10-28",
    );
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    const history = screen.getByRole("list", { name: "Podejścia" });
    expect(await within(history).findByText("Ukończone")).toBeInTheDocument();
    expect(within(history).getByText("28.10.2026")).toBeInTheDocument();
    const created = backend.requests.find(
      (r) => r.path.includes("/bibliography-attempts/") && r.method === "POST",
    );
    expect(created?.body).toEqual({
      item: 2,
      outcome: "finished",
      started_on: null,
      ended_on: "2026-10-28",
    });
  });

  test("an end date before the start date is rejected before saving", async () => {
    const backend = fakeBackend([lalka]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(
      await screen.findByRole("button", { name: "Dodaj ukończone" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("Data rozpoczęcia"),
      "2026-10-10",
    );
    await user.clear(within(dialog).getByLabelText("Data zakończenia"));
    await user.type(
      within(dialog).getByLabelText("Data zakończenia"),
      "2026-10-01",
    );
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    expect(
      await within(dialog).findByText(
        "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.",
      ),
    ).toBeInTheDocument();
    expect(
      backend.requests.some(
        (r) =>
          r.path.includes("/bibliography-attempts/") && r.method === "POST",
      ),
    ).toBe(false);
  });

  test("the history lists the latest Attempt first and its dates can be edited", async () => {
    const backend = fakeBackend(
      [lalka],
      [
        attempt({ id: 51, outcome: "finished", ended_on: "2026-03-01" }),
        attempt({ id: 52, outcome: "abandoned", ended_on: "2019-05-01" }),
      ],
    );
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    const history = await screen.findByRole("list", { name: "Podejścia" });
    const [first, second] = within(history).getAllByRole("listitem");
    expect(within(first).getByText("Ukończone")).toBeInTheDocument();
    expect(within(second).getByText("Porzucone")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveTextContent("Ukończone");

    await user.click(within(second).getByRole("button", { name: "Edytuj" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Data zakończenia")).toHaveValue(
      "2019-05-01",
    );
    await user.type(
      within(dialog).getByLabelText("Data rozpoczęcia"),
      "2019-04-01",
    );
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    expect(
      await within(history).findByText("01.04.2019 – 01.05.2019"),
    ).toBeInTheDocument();
    const patch = backend.requests.find(
      (r) =>
        r.path.includes("/bibliography-attempts/52/") && r.method === "PATCH",
    );
    expect(patch?.body).toEqual({
      started_on: "2019-04-01",
      ended_on: "2019-05-01",
    });
  });

  test("user can delete a BibliographyItem and lands back on the list", async () => {
    const backend = fakeBackend([lalka, rejs], [attempt({ id: 51 })]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(
      await screen.findByRole("button", { name: "Usuń pozycję" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent('„Lalka" i wszystkie jej podejścia');
    await user.click(
      within(dialog).getByRole("button", { name: "Usuń pozycję" }),
    );

    const list = await screen.findByRole("list", { name: "Pozycje" });
    expect(within(list).getByText("Rejs")).toBeInTheDocument();
    expect(within(list).queryByText("Lalka")).not.toBeInTheDocument();
    expect(
      backend.requests.some(
        (r) =>
          r.path.includes("/bibliography-items/1/") && r.method === "DELETE",
      ),
    ).toBe(true);
  });

  test("user can delete an Attempt and the status follows the rest", async () => {
    const backend = fakeBackend(
      [lalka],
      [
        attempt({ id: 51, outcome: "abandoned", ended_on: "2026-03-01" }),
        attempt({ id: 52, outcome: "finished", ended_on: "2019-05-01" }),
      ],
    );
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    const history = await screen.findByRole("list", { name: "Podejścia" });
    expect(screen.getByLabelText("Status")).toHaveTextContent("Porzucone");
    const [latest] = within(history).getAllByRole("listitem");
    await user.click(within(latest).getByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Usuń podejście",
      }),
    );

    expect(await screen.findByLabelText("Status")).toHaveTextContent(
      "Ukończone",
    );
    await screen.findByText("01.05.2019");
    expect(within(history).getAllByRole("listitem")).toHaveLength(1);
  });

  test("user can update the progress of a book in progress and sees the percentage", async () => {
    const backend = fakeBackend(
      [lalka],
      [attempt({ outcome: "in_progress", ended_on: null })],
    );
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(await screen.findByRole("button", { name: "Postęp" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Strona"), "170");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    expect(await screen.findByLabelText("Postęp")).toHaveTextContent(
      "Strona 170 z 680 · 25%",
    );
    expect(screen.getByLabelText("Status")).toHaveTextContent("W trakcie");
    const patch = backend.requests.find(
      (r) =>
        r.path.includes("/bibliography-attempts/50/") && r.method === "PATCH",
    );
    expect(patch?.body).toEqual({ progress: 170 });
  });

  test("a film without a length shows the minute without a percentage", async () => {
    fetchMock.mockImplementation(
      fakeBackend(
        [{ ...rejs, length: null }],
        [
          attempt({
            item_id: rejs.id,
            outcome: "in_progress",
            ended_on: null,
            progress: 45,
          }),
        ],
      ).handler,
    );

    renderApp("/bibliography/2");

    expect(await screen.findByLabelText("Postęp")).toHaveTextContent(
      /^Minuta 45$/,
    );
  });

  test("progress past the length is rejected before saving", async () => {
    const backend = fakeBackend(
      [lalka],
      [attempt({ outcome: "in_progress", ended_on: null, progress: 10 })],
    );
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography/1");
    await user.click(await screen.findByRole("button", { name: "Postęp" }));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("Strona");
    expect(field).toHaveValue(10);
    await user.clear(field);
    await user.type(field, "681");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));

    expect(
      within(dialog).getByText("Postęp nie może przekraczać długości (680)."),
    ).toBeInTheDocument();
    expect(backend.requests.some((r) => r.method === "PATCH")).toBe(false);
  });

  test("an ended Attempt shows no progress", async () => {
    fetchMock.mockImplementation(
      fakeBackend([lalka], [attempt({ outcome: "finished" })]).handler,
    );

    renderApp("/bibliography/1");

    expect(
      await screen.findByRole("list", { name: "Podejścia" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Postęp")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Postęp" }),
    ).not.toBeInTheDocument();
  });

  describe("filters", () => {
    const chlopi: BibliographyItem = { ...lalka, id: 3, title: "Chłopi" };
    const seksmisja: BibliographyItem = { ...rejs, id: 4, title: "Seksmisja" };
    const shelf = () =>
      fakeBackend(
        [seksmisja, chlopi, rejs, lalka],
        [
          attempt({
            id: 61,
            item_id: chlopi.id,
            outcome: "in_progress",
            ended_on: null,
          }),
          attempt({ id: 62, item_id: rejs.id, outcome: "finished" }),
        ],
      );

    async function listedTitles() {
      const list = screen.queryByRole("list", { name: "Pozycje" });
      if (!list) return [];
      return within(list)
        .getAllByRole("listitem")
        .map((row) =>
          within(row)
            .getByRole("button")
            .getAttribute("aria-label")
            ?.replace("Otwórz pozycję: ", ""),
        );
    }

    function statusFilter() {
      return screen.getByRole("group", { name: "Filtr statusu" });
    }

    function kindFilter() {
      return screen.getByRole("group", { name: "Filtr rodzaju" });
    }

    test("both filters default to all", async () => {
      fetchMock.mockImplementation(shelf().handler);

      renderApp("/bibliography");
      await screen.findByRole("list", { name: "Pozycje" });

      expect(
        within(statusFilter()).getByRole("button", { name: "Wszystkie" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(kindFilter()).getByRole("button", { name: "Wszystkie" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(await listedTitles()).toEqual([
        "Seksmisja",
        "Chłopi",
        "Rejs",
        "Lalka",
      ]);
    });

    test("status and kind filters combine", async () => {
      fetchMock.mockImplementation(shelf().handler);
      const user = userEvent.setup();

      renderApp("/bibliography");
      await screen.findByRole("list", { name: "Pozycje" });

      await user.click(
        within(kindFilter()).getByRole("button", { name: "Książki" }),
      );
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Chłopi", "Lalka"]),
      );

      await user.click(
        within(statusFilter()).getByRole("button", { name: "W trakcie" }),
      );
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Chłopi"]),
      );
      const list = screen.getByRole("list", { name: "Pozycje" });
      expect(within(list).getByText("W trakcie")).toBeInTheDocument();

      await user.click(
        within(kindFilter()).getByRole("button", { name: "Filmy" }),
      );
      expect(
        await screen.findByText("Brak pozycji pasujących do filtrów"),
      ).toBeInTheDocument();

      await user.click(
        within(statusFilter()).getByRole("button", { name: "Ukończone" }),
      );
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Rejs"]),
      );
    });

    test("the to-watch/to-read filter is named after the chosen kind", async () => {
      fetchMock.mockImplementation(shelf().handler);
      const user = userEvent.setup();

      renderApp("/bibliography");
      await screen.findByRole("list", { name: "Pozycje" });
      expect(
        within(statusFilter()).getByRole("button", {
          name: "Do obejrzenia / przeczytania",
        }),
      ).toBeInTheDocument();

      await user.click(
        within(kindFilter()).getByRole("button", { name: "Filmy" }),
      );
      await user.click(
        within(statusFilter()).getByRole("button", { name: "Do obejrzenia" }),
      );
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Seksmisja"]),
      );

      await user.click(
        within(kindFilter()).getByRole("button", { name: "Książki" }),
      );
      expect(
        within(statusFilter()).getByRole("button", { name: "Do przeczytania" }),
      ).toHaveAttribute("aria-pressed", "true");
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Lalka"]),
      );
    });

    test("the filters are kept in the address", async () => {
      fetchMock.mockImplementation(shelf().handler);

      renderApp("/bibliography?status=planned&kind=film");

      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Seksmisja"]),
      );
      expect(
        within(kindFilter()).getByRole("button", { name: "Filmy" }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    test("a new item shows only where it matches the filters", async () => {
      fetchMock.mockImplementation(shelf().handler);
      const user = userEvent.setup();

      renderApp("/bibliography?status=in_progress");
      await vi.waitFor(async () =>
        expect(await listedTitles()).toEqual(["Chłopi"]),
      );

      await user.click(screen.getByRole("button", { name: "Nowa pozycja" }));
      await user.selectOptions(screen.getByLabelText("Rodzaj"), "book");
      await user.type(screen.getByLabelText("Tytuł"), "Solaris");
      await user.click(screen.getByRole("button", { name: "Dodaj pozycję" }));
      await vi.waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(await listedTitles()).toEqual(["Chłopi"]);

      await user.click(
        within(statusFilter()).getByRole("button", { name: "Wszystkie" }),
      );
      await vi.waitFor(async () =>
        expect((await listedTitles())[0]).toBe("Solaris"),
      );
    });
  });
});
