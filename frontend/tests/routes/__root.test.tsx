/** User-visible routing tests: the URL drives the view and the selected ProjectResponse. */

import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";

const DEFAULT_STATUSES = ["Todo", "Zrobione"];

const inbox = {
  id: 1,
  name: "Inbox",
  description: "",
  is_inbox: true,
  project_statuses: DEFAULT_STATUSES,
  terminal_status: "Zrobione",
};

const planning = {
  id: 2,
  name: "Planning",
  description: "",
  is_inbox: false,
  project_statuses: DEFAULT_STATUSES,
  terminal_status: "Zrobione",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("Routing", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.startsWith("/api/v1/projects/"))
        return Promise.resolve(jsonResponse([inbox, planning]));
      if (url.startsWith("/api/v1/tasks/"))
        return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/api/v1/timer/")) {
        return Promise.resolve(
          jsonResponse({ entry: null, server_now: "2026-10-15T12:00:00Z" }),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("the app opens on the main page", async () => {
    renderApp("/");

    expect(
      await within(await screen.findByRole("main")).findByRole("link", {
        name: /Wydatki/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Zadania" }),
    ).not.toBeInTheDocument();
  });

  test("an unknown URL shows a not-found page", async () => {
    renderApp("/no-such-page");

    expect(
      await screen.findByRole("heading", { name: "Tej strony nie ma" }),
    ).toBeInTheDocument();
  });

  test("a URL naming a ProjectResponse that does not exist drops it from the URL", async () => {
    const { router } = renderApp("/tasks?project=999");

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe("/tasks");
    expect(
      screen.queryByRole("heading", { name: "Tej strony nie ma" }),
    ).not.toBeInTheDocument();
  });

  test("a failed projects load does not masquerade as a missing ProjectResponse", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ detail: "Nie udało się" }, 500)),
    );

    renderApp("/tasks?project=2");

    expect(
      await screen.findByRole("heading", {
        name: "Utwórz pierwsze miejsce pracy",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Tej strony nie ma" }),
    ).not.toBeInTheDocument();
  });

  test("the selected ProjectResponse is kept in the URL after a refresh", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });

    await user.click(screen.getByRole("link", { name: "Planning" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Planning" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(router.state.location.pathname).toBe("/tasks");
    expect(router.state.location.search).toMatchObject({ project: 2 });

    // A refresh is a fresh mount at the same URL.
    cleanup();
    renderApp("/tasks?project=2");

    expect(
      await screen.findByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the selected ProjectResponse is remembered between sessions", async () => {
    const user = userEvent.setup();

    // First session: the user picks Planning and the app remembers it.
    const first = renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });
    await user.click(screen.getByRole("link", { name: "Planning" }));
    await waitFor(() =>
      expect(first.router.state.location.search).toMatchObject({ project: 2 }),
    );
    expect(window.localStorage.getItem("lastProject:1")).toBe("2");
    cleanup();

    // Reopening the bare Tasks URL restores the remembered project.
    // renderApp clears localStorage, so put the remembered value back before
    // the project list finishes loading.
    const second = renderApp("/tasks");
    window.localStorage.setItem("lastProject:1", "2");

    await waitFor(() =>
      expect(second.router.state.location.search).toMatchObject({ project: 2 }),
    );
    expect(
      await screen.findByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("a remembered ProjectResponse that no longer exists falls back to the default", async () => {
    const { router } = renderApp("/tasks");
    window.localStorage.setItem("lastProject:1", "999");

    expect(await screen.findByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(router.state.location.search).not.toMatchObject({ project: 999 });
  });

  test("sidebar ProjectResponse links and topbar tabs change the URL", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });

    await user.click(screen.getByRole("link", { name: "Planning" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ project: 2 }),
    );
    expect(router.state.location.pathname).toBe("/tasks");

    await user.click(screen.getByRole("link", { name: "Czas" }));
    await screen.findByRole("heading", { name: "Timer" });
    expect(router.state.location.pathname).toBe("/timer");
  });

  test("the brand returns to the main page without a full page reload", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });

    await user.click(
      screen.getByRole("link", { name: "DjangoPersonal — strona główna" }),
    );

    expect(
      await within(await screen.findByRole("main")).findByRole("link", {
        name: /Wydatki/,
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  test("browser back and forward move between views and Projects", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });

    await user.click(screen.getByRole("link", { name: "Planning" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ project: 2 }),
    );
    await user.click(screen.getByRole("link", { name: "Czas" }));
    await screen.findByRole("heading", { name: "Timer" });
    expect(router.state.location.pathname).toBe("/timer");

    await act(async () => {
      router.history.back();
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
    expect(
      await screen.findByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page");

    await act(async () => {
      router.history.back();
    });
    await waitFor(() =>
      expect(router.state.location.search).not.toMatchObject({ project: 2 }),
    );
    expect(await screen.findByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await act(async () => {
      router.history.forward();
    });
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ project: 2 }),
    );
    expect(
      await screen.findByRole("link", { name: "Planning" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
