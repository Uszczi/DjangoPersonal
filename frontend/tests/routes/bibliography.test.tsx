/** User-visible Bibliography flow tests, against a small in-memory fake of the BibliographyItems API. */

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

type BibliographyItem = {
  id: number;
  kind: "film" | "book";
  title: string;
  creator: string;
  year: number | null;
  length: number | null;
  note: string;
  status: "planned";
  created_at: string;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers the BibliographyItems endpoints the way the backend does: newest first. */
function fakeBackend(initial: BibliographyItem[] = []) {
  const items = [...initial];
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  let nextId = 100;

  const handler = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ method, path, body });
    if (path.includes("/projects/")) return jsonResponse([]);

    if (path.endsWith("/bibliography-items/")) {
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
      return jsonResponse(items);
    }
    const match = path.match(/\/bibliography-items\/(\d+)\/$/);
    if (match) {
      const item = items.find((item) => item.id === Number(match[1]));
      if (!item)
        return jsonResponse({ detail: "BibliographyItem not found." }, 404);
      if (method === "PATCH") Object.assign(item, body);
      return jsonResponse(item);
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

describe("Bibliography", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
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
    const rejs: BibliographyItem = {
      ...lalka,
      id: 2,
      kind: "film",
      title: "Rejs",
      creator: "",
      year: null,
    };
    fetchMock.mockImplementation(fakeBackend([rejs, lalka]).handler);

    renderApp("/bibliography");
    const list = await screen.findByRole("list", { name: "Pozycje" });
    const [first, second] = within(list).getAllByRole("listitem");

    expect(within(first).getByText("Rejs")).toBeInTheDocument();
    expect(within(first).getByText("Film")).toBeInTheDocument();
    expect(within(first).getByText("Do obejrzenia")).toBeInTheDocument();
    expect(within(second).getByText("Lalka")).toBeInTheDocument();
    expect(within(second).getByText("Książka")).toBeInTheDocument();
    expect(
      within(second).getByText("Bolesław Prus · 1890"),
    ).toBeInTheDocument();
    expect(within(second).getByText("Do przeczytania")).toBeInTheDocument();
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

  test("user can edit a BibliographyItem but not its kind", async () => {
    const backend = fakeBackend([lalka]);
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/bibliography");
    await user.click(
      await screen.findByRole("button", { name: "Edytuj pozycję: Lalka" }),
    );
    expect(screen.getByLabelText("Rodzaj")).toBeDisabled();
    expect(screen.getByLabelText("Liczba stron")).toHaveValue(680);
    const title = screen.getByLabelText("Tytuł");
    await user.clear(title);
    await user.type(title, "Lalka (wyd. II)");
    await user.clear(screen.getByLabelText("Rok"));
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    const list = await screen.findByRole("list", { name: "Pozycje" });
    expect(
      await within(list).findByText("Lalka (wyd. II)"),
    ).toBeInTheDocument();
    expect(within(list).getByText("Bolesław Prus")).toBeInTheDocument();
    const patch = backend.requests.find((r) => r.method === "PATCH");
    expect(patch?.body).not.toHaveProperty("kind");
    expect(patch?.body).toMatchObject({ title: "Lalka (wyd. II)", year: null });
  });
});
