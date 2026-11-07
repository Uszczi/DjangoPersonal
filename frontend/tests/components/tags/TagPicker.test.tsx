/** Tags in the Task editor, the Task list's Tag filter and the Tag manager, with HTTP mocked by URL. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../../renderApp";
import { uid } from "../../ids";

const inbox = {
  id: uid(1),
  name: "Inbox",
  description: "",
  is_inbox: true,
  project_statuses: ["Todo", "Zrobione"],
  terminal_status: "Zrobione",
};

const urgent = { id: uid(41), name: "Pilne", color: "#d45b3e" };
const shopping = { id: uid(42), name: "Zakupy", color: "#3d6fb6" };
// The client's camelCase shape, for seeding the cache.
const seededTags = [urgent, shopping];

function task(id: number, title: string, tags: string[]) {
  return {
    id: uid(id),
    title,
    description: "",
    project_id: uid(1),
    status: "Todo",
    tags,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Tags", () => {
  const fetchMock = vi.fn();
  let tasks = [task(7, "Kupić farbę", [shopping.id]), task(8, "Zadzwonić", [])];

  beforeEach(() => {
    tasks = [task(7, "Kupić farbę", [shopping.id]), task(8, "Zadzwonić", [])];
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      (url: string, init?: RequestInit): Promise<Response> => {
        const method = init?.method ?? "GET";
        if (url === "/api/v1/projects/")
          return Promise.resolve(jsonResponse([inbox]));
        if (url.startsWith("/api/v1/tasks/?"))
          return Promise.resolve(jsonResponse(tasks));
        if (url === `/api/v1/tasks/${uid(8)}/` && method === "PATCH") {
          const body = JSON.parse(String(init?.body)) as { tags: string[] };
          tasks = [tasks[0], { ...tasks[1], tags: body.tags }];
          return Promise.resolve(jsonResponse(tasks[1]));
        }
        if (url === "/api/v1/tags/" && method === "POST")
          return Promise.resolve(
            jsonResponse({ id: uid(43), name: "Dom", color: "#7a5ab8" }, 201),
          );
        if (url === `/api/v1/tags/${urgent.id}/` && method === "PATCH")
          return Promise.resolve(
            jsonResponse({ ...urgent, name: "Bardzo pilne" }),
          );
        if (url === `/api/v1/tags/${shopping.id}/` && method === "DELETE")
          return Promise.resolve(jsonResponse(null, 204));
        return Promise.resolve(jsonResponse({ detail: "Not found" }, 404));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function row(title: string) {
    return screen.getByRole("button", { name: `Edytuj zadanie: ${title}` });
  }

  test("a task row shows its tags", async () => {
    renderApp("/tasks", { tags: seededTags });

    await screen.findByText("Kupić farbę");
    expect(within(row("Kupić farbę")).getByText("Zakupy")).toBeInTheDocument();
    expect(
      within(row("Zadzwonić")).queryByText("Zakupy"),
    ).not.toBeInTheDocument();
  });

  test("the user picks a tag and creates a new one in the task editor", async () => {
    const user = userEvent.setup();
    renderApp("/tasks", { tags: seededTags });

    await user.click(
      await screen.findByRole("button", { name: "Edytuj zadanie: Zadzwonić" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    const tagGroup = screen.getByRole("group", { name: "Tagi" });
    await user.click(within(tagGroup).getByRole("button", { name: "Pilne" }));
    await user.type(within(tagGroup).getByLabelText("Nowy tag"), "Dom{Enter}");
    await waitFor(() =>
      expect(
        within(tagGroup).getByRole("button", { name: "Dom" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/tasks/${uid(8)}/`,
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining(`"tags":["${urgent.id}","${uid(43)}"]`),
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/tags/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Dom", color: "#3d6fb6" }),
      }),
    );
    expect(
      await within(row("Zadzwonić")).findByText("Dom"),
    ).toBeInTheDocument();
  });

  test("typing an existing tag's name picks it instead of creating another", async () => {
    const user = userEvent.setup();
    renderApp("/tasks", { tags: seededTags });

    await user.click(
      await screen.findByRole("button", { name: "Edytuj zadanie: Zadzwonić" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    const tagGroup = screen.getByRole("group", { name: "Tagi" });
    await user.type(
      within(tagGroup).getByLabelText("Nowy tag"),
      " pilne {Enter}",
    );

    expect(
      within(tagGroup).getByRole("button", { name: "Pilne" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/tags/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("the tag filter narrows the list and is kept in the address", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/tasks", { tags: seededTags });
    await screen.findByText("Kupić farbę");

    const filter = screen.getByRole("group", { name: "Filtruj po tagu" });
    await user.click(within(filter).getByRole("button", { name: "Zakupy" }));

    await waitFor(() =>
      expect(screen.queryByText("Zadzwonić")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Kupić farbę")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ tag: shopping.id });

    await user.click(within(filter).getByRole("button", { name: "Pilne" }));
    expect(
      await screen.findByText(
        "Żadne zadanie w tym projekcie nie ma tego tagu.",
      ),
    ).toBeInTheDocument();

    await user.click(within(filter).getByRole("button", { name: "Pilne" }));
    expect(await screen.findByText("Zadzwonić")).toBeInTheDocument();
  });

  test("the tag manager renames a tag and deletes another from every task", async () => {
    const user = userEvent.setup();
    renderApp("/tasks", { tags: seededTags });
    await screen.findByText("Kupić farbę");

    await user.click(screen.getByRole("button", { name: "Zarządzaj tagami" }));
    await user.click(
      await screen.findByRole("button", { name: "Edytuj tag: Pilne" }),
    );
    const name = screen.getByLabelText("Nazwa tagu");
    await user.clear(name);
    await user.type(name, "Bardzo pilne");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const list = await screen.findByRole("list", { name: "Tagi" });
    expect(await within(list).findByText("Bardzo pilne")).toBeInTheDocument();

    await user.click(
      within(list).getByRole("button", { name: "Edytuj tag: Zakupy" }),
    );
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    await user.click(
      screen.getByRole("button", { name: "Usuń z wszystkich zadań" }),
    );

    await waitFor(() =>
      expect(within(list).queryByText("Zakupy")).not.toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/tags/${shopping.id}/`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
