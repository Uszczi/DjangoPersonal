/** Asking the Notatki a question, against a fake of the API. */

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../../renderApp";

vi.mock("@/components/WhiteboardCanvas", () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const NOTE = {
  id: 7,
  kind: "markdown",
  name: "Samochód",
  folder_id: null,
  content: { markdown: "## Ubezpieczenie\n\nOC kończy się 14 marca." },
  created_at: "2026-10-20T10:00:00Z",
  updated_at: "2026-10-20T10:00:00Z",
};

const ANSWER = {
  answer: "OC kończy się 14 marca [1].",
  sources: [
    {
      number: 1,
      whiteboard_id: 7,
      heading: "Samochód / Ubezpieczenie",
      text: "OC kończy się **14 marca**.",
      score: 0.82,
    },
  ],
};

/** The Notatnik's lists, plus `ask` answering POST /notes/ask/. */
function fakeBackend(ask: (question: string) => Response) {
  const questions: string[] = [];
  const handler = async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const path = String(url);
    if (path.includes("/notes/ask/")) {
      const { question } = JSON.parse(String(init?.body)) as {
        question: string;
      };
      questions.push(question);
      return ask(question);
    }
    if (path.endsWith("/folders/")) return jsonResponse([]);
    if (path.endsWith("/whiteboards/")) return jsonResponse([NOTE]);
    if (path.includes("/whiteboards/7/")) return jsonResponse(NOTE);
    if (path.includes("/timer/"))
      return jsonResponse({ entry: null, server_now: "2026-10-25T12:00:00Z" });
    return jsonResponse([]);
  };
  return { handler, questions };
}

describe("Zapytaj Notatki", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("the Notatnik tree opens the questions page", async () => {
    fetchMock.mockImplementation(
      fakeBackend(() => jsonResponse(ANSWER)).handler,
    );
    const user = userEvent.setup();

    renderApp("/whiteboard");
    await user.click(
      await screen.findByRole("button", { name: "Zapytaj Notatki" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Zapytaj Notatki" }),
    ).toBeInTheDocument();
  });

  test("shows the answer with its citations and the cited fragments", async () => {
    const backend = fakeBackend(() => jsonResponse(ANSWER));
    fetchMock.mockImplementation(backend.handler);
    const user = userEvent.setup();

    renderApp("/whiteboard/ask");
    await user.type(
      await screen.findByRole("textbox", { name: "Pytanie" }),
      "  Kiedy kończy się OC?{Enter}",
    );

    const answer = await screen.findByRole("region", { name: "Odpowiedź" });
    expect(answer).toHaveTextContent("OC kończy się 14 marca [1].");
    expect(
      within(answer).getByRole("button", { name: "Źródło 1" }),
    ).toBeInTheDocument();
    const sources = within(answer).getByRole("list", { name: "Źródła" });
    expect(sources).toHaveTextContent("Samochód / Ubezpieczenie");
    expect(within(sources).getByText("14 marca").tagName).toBe("STRONG");
    expect(backend.questions).toEqual(["Kiedy kończy się OC?"]);

    await user.click(
      within(sources).getByRole("link", { name: "Otwórz notatkę" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Samochód" }),
    ).toBeInTheDocument();
  });

  test("says so when the Notatki do not answer", async () => {
    fetchMock.mockImplementation(
      fakeBackend(() =>
        jsonResponse({
          answer: "Nie znalazłem tego w Notatkach.",
          sources: [],
        }),
      ).handler,
    );
    const user = userEvent.setup();

    renderApp("/whiteboard/ask");
    await user.type(
      await screen.findByRole("textbox", { name: "Pytanie" }),
      "Przepis na pierogi?",
    );
    await user.click(screen.getByRole("button", { name: "Zapytaj" }));

    const answer = await screen.findByRole("region", { name: "Odpowiedź" });
    expect(answer).toHaveTextContent("Nie znalazłem tego w Notatkach.");
    expect(
      within(answer).queryByRole("list", { name: "Źródła" }),
    ).not.toBeInTheDocument();
  });

  test("explains how to fix a missing model", async () => {
    fetchMock.mockImplementation(
      fakeBackend(() =>
        jsonResponse(
          { detail: "No answer model is configured (LLM_MODEL)." },
          503,
        ),
      ).handler,
    );
    const user = userEvent.setup();

    renderApp("/whiteboard/ask");
    await user.type(
      await screen.findByRole("textbox", { name: "Pytanie" }),
      "Kiedy OC?{Enter}",
    );

    expect(
      await screen.findByText(/Model nie jest teraz dostępny/),
    ).toHaveTextContent("No answer model is configured (LLM_MODEL).");
  });

  test("a blank question cannot be sent", async () => {
    fetchMock.mockImplementation(
      fakeBackend(() => jsonResponse(ANSWER)).handler,
    );
    const user = userEvent.setup();

    renderApp("/whiteboard/ask");
    await user.type(
      await screen.findByRole("textbox", { name: "Pytanie" }),
      "   ",
    );

    expect(screen.getByRole("button", { name: "Zapytaj" })).toBeDisabled();
  });
});
