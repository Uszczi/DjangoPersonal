/** The saved query cache: a reload paints the last data before the server answers. */
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  deserializeCache,
  serializeCache,
} from "@personal/shared/queries/persist";
import { useAuthStore } from "@personal/shared/stores/auth";

import { renderApp } from "../../renderApp";

const CACHE_KEY = "personal-query-cache";

const inbox = {
  id: 1,
  name: "Inbox",
  description: "",
  is_inbox: true,
  project_statuses: ["Todo", "Zrobione"],
  terminal_status: "Zrobione",
};
const planning = { ...inbox, id: 2, name: "Planning", is_inbox: false };

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("after a reload the Projects show from the saved cache while the server is still answering", async () => {
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/v1/projects/"
      ? jsonResponse([inbox, planning])
      : jsonResponse([]),
  );
  const first = renderApp("/projects");
  expect(await screen.findByText("Planning")).toBeInTheDocument();
  // The cache is written shortly after it changes.
  await waitFor(
    () => expect(window.localStorage.getItem(CACHE_KEY)).toContain("Planning"),
    { timeout: 3000 },
  );
  first.unmount();

  // A fresh start: empty in-memory cache, a server that has not answered yet.
  fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
  renderApp("/projects", { preserveStorage: true });

  expect(await screen.findByText("Planning")).toBeInTheDocument();
  expect(screen.queryByText("Wczytywanie projektów…")).not.toBeInTheDocument();
});

test("signing out empties the saved cache", async () => {
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/v1/projects/" ? jsonResponse([inbox]) : jsonResponse([]),
  );
  renderApp("/projects");
  await waitFor(
    () => expect(window.localStorage.getItem(CACHE_KEY)).toContain("Inbox"),
    { timeout: 3000 },
  );

  useAuthStore.getState().logout();

  await waitFor(
    () =>
      expect(window.localStorage.getItem(CACHE_KEY) ?? "").not.toContain(
        "Inbox",
      ),
    { timeout: 3000 },
  );
});

test("dates in the saved cache come back as dates, and date-like text stays text", () => {
  const saved = {
    endedOn: new Date("2026-02-01T00:00:00Z"),
    title: "2026-02-01",
    nested: [{ at: new Date("2025-05-10T12:30:00Z") }],
  };

  const restored = deserializeCache<typeof saved>(serializeCache(saved));

  expect(restored.endedOn).toBeInstanceOf(Date);
  expect(restored.endedOn.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  expect(restored.nested[0].at).toBeInstanceOf(Date);
  expect(restored.title).toBe("2026-02-01");
});
