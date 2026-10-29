/** Commenting on a Task and attaching pictures, with HTTP mocked at the network boundary. */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../../renderApp";

const inbox = {
  id: 1,
  name: "Inbox",
  description: "",
  is_inbox: true,
  project_statuses: ["Todo", "Zrobione"],
  terminal_status: "Zrobione",
};

const task = {
  id: 7,
  title: "Prepare outline",
  description: "",
  project_id: 1,
  status: "Todo",
};

const photo = {
  id: 40,
  comment_id: 30,
  file_name: "tablica.jpg",
  content_type: "image/jpeg",
  size: 2_400_000,
  is_image: true,
  created_at: "2026-10-29T10:00:00Z",
};

const manual = {
  ...photo,
  id: 41,
  file_name: "instrukcja.pdf",
  content_type: "application/pdf",
  is_image: false,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The server: one Inbox Task whose comments live in `comments`. */
function serve(comments: Record<string, unknown>[]) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/v1/projects/") return jsonResponse([inbox]);
    if (url.startsWith("/api/v1/tasks/")) return jsonResponse([task]);
    if (url === "/api/v1/task-comments/?task=7") return jsonResponse(comments);
    if (url === "/api/v1/task-comments/" && method === "POST") {
      const { body } = JSON.parse(String(init?.body)) as { body: string };
      const created = {
        id: 30,
        task_id: 7,
        body,
        created_at: "2026-10-29T10:00:00Z",
        attachments: [] as unknown[],
      };
      comments.push(created);
      return jsonResponse(created, 201);
    }
    if (url === "/api/v1/task-comments/30/attachments/") {
      (comments[0].attachments as unknown[]).push(photo);
      return jsonResponse(photo, 201);
    }
    if (url.startsWith("/api/v1/comment-attachments/")) {
      return new Response(new Blob(["bytes"], { type: "image/jpeg" }));
    }
    if (url === "/api/v1/task-comments/30/" && method === "DELETE") {
      comments.splice(0, 1);
      return jsonResponse(null, 204);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

async function openTask() {
  const user = userEvent.setup();
  renderApp("/tasks");
  await user.click(
    await screen.findByRole("button", {
      name: "Edytuj zadanie: Prepare outline",
    }),
  );
  return { user, dialog: screen.getByRole("dialog") };
}

describe("Task comments", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // jsdom has no object URLs; any string will do for an <img>.
    let next = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:test/${(next += 1)}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("user comments on a task with a picture, sent as the original file", async () => {
    fetchMock.mockImplementation(serve([]));
    const { user, dialog } = await openTask();
    expect(await within(dialog).findByText("Brak komentarzy.")).toBeVisible();

    const picture = new File(["original bytes"], "tablica.jpg", {
      type: "image/jpeg",
    });
    await user.type(
      within(dialog).getByLabelText("Nowy komentarz"),
      "Zdjęcie tablicy",
    );
    await user.upload(
      within(dialog).getByTestId("comment-file-input"),
      picture,
    );
    expect(
      within(dialog).getByRole("button", { name: "Nie dołączaj: tablica.jpg" }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Dodaj komentarz" }),
    );

    expect(await within(dialog).findByText("Zdjęcie tablicy")).toBeVisible();
    expect(
      await within(dialog).findByRole("img", { name: "tablica.jpg" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nowy komentarz")).toHaveValue("");

    const upload = fetchMock.mock.calls.find(
      ([url]) => url === "/api/v1/task-comments/30/attachments/",
    );
    expect(upload).toBeDefined();
    const sent = (upload![1] as RequestInit).body as FormData;
    expect(sent.get("file")).toBe(picture);
  });

  test("files that are not pictures are listed by name and size", async () => {
    fetchMock.mockImplementation(
      serve([
        {
          id: 30,
          task_id: 7,
          body: "",
          created_at: "2026-10-29T10:00:00Z",
          attachments: [manual],
        },
      ]),
    );
    const { dialog } = await openTask();

    expect(
      await within(dialog).findByRole("button", {
        name: "instrukcja.pdf · 2,3 MB",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  });

  test("user adds a picture to a comment that already exists", async () => {
    fetchMock.mockImplementation(
      serve([
        {
          id: 30,
          task_id: 7,
          body: "Najpierw tekst",
          created_at: "2026-10-29T10:00:00Z",
          attachments: [],
        },
      ]),
    );
    const { user, dialog } = await openTask();
    await within(dialog).findByText("Najpierw tekst");

    const picture = new File(["original bytes"], "tablica.jpg", {
      type: "image/jpeg",
    });
    await user.upload(
      within(dialog).getByTestId("comment-30-file-input"),
      picture,
    );

    expect(
      await within(dialog).findByRole("img", { name: "tablica.jpg" }),
    ).toBeInTheDocument();
    const upload = fetchMock.mock.calls.find(
      ([url]) => url === "/api/v1/task-comments/30/attachments/",
    );
    expect(upload).toBeDefined();
    expect(((upload![1] as RequestInit).body as FormData).get("file")).toBe(
      picture,
    );
  });

  test("user deletes a comment after confirming", async () => {
    fetchMock.mockImplementation(
      serve([
        {
          id: 30,
          task_id: 7,
          body: "Do usunięcia",
          created_at: "2026-10-29T10:00:00Z",
          attachments: [],
        },
      ]),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, dialog } = await openTask();

    await user.click(
      await within(dialog).findByRole("button", { name: "Usuń komentarz" }),
    );

    await waitFor(() =>
      expect(
        within(dialog).queryByText("Do usunięcia"),
      ).not.toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/task-comments/30/",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
