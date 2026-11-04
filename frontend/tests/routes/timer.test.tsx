/** User-visible Time tracking flow tests, with HTTP mocked at the network boundary. */

import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderApp } from "../renderApp";
import { uid } from "../ids";

const inbox = {
  id: uid(1),
  name: "Inbox",
  description: "",
  is_inbox: true,
  project_statuses: ["Todo", "Zrobione"],
  terminal_status: "Zrobione",
};

const task = {
  id: uid(7),
  title: "Prepare outline",
  description: "",
  project_id: uid(1),
  status: "Todo",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgoKey(days: number) {
  const day = new Date();
  day.setDate(day.getDate() - days);
  return localDateKey(day);
}

function timerResponse(entry: unknown) {
  return jsonResponse({ entry, server_now: "2026-10-15T12:00:00Z" });
}

function entryPayload(
  id: string,
  dateKey: string,
  startTime: string,
  endTime: string,
) {
  return {
    id,
    task_id: task.id,
    start: `${dateKey}T${startTime}Z`,
    end: `${dateKey}T${endTime}Z`,
  };
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

describe("Time tracking", () => {
  const fetchMock = vi.fn();
  /** The start form's title suggestions, kept apart so the other requests keep their order. */
  const titlesMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    titlesMock.mockReset();
    titlesMock.mockImplementation(() => Promise.resolve(jsonResponse([])));
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      requestUrl(input).startsWith("/api/v1/time-entries/titles/")
        ? titlesMock(requestUrl(input))
        : fetchMock(input, init),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("user can open the timer page and sees its sections", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await screen.findByRole("link", { name: "Inbox" });
    await screen.findByText("Nie ma tu jeszcze zadań.");

    await user.click(screen.getByRole("link", { name: "Czas" }));

    expect(
      await screen.findByRole("heading", { name: "Czas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dziennik" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Statystyki" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Bieżący timer" })).getByRole(
        "button",
        { name: "Rozpocznij timer" },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Ostatnie 7 dni" }),
    ).toHaveTextContent("0 min");
    expect(
      screen.getByText(
        "Nie ma jeszcze wpisów. Uruchom timer albo dodaj wpis ręcznie.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Wpis ręczny" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/timer/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/v1/time-entries/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/v1/tasks/?all=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("the URL project preselects the timer and the manual entry and starts one of its tasks", async () => {
    const planning = {
      id: uid(2),
      name: "Planning",
      description: "",
      is_inbox: false,
    };
    const planningTask = {
      ...task,
      id: uid(8),
      title: "Plan release",
      project_id: planning.id,
    };
    const runningEntry = {
      id: uid(5),
      task: planningTask.id,
      start: `${daysAgoKey(0)}T12:00:00Z`,
      end: null,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox, planning]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([]));
      if (url === "/api/v1/tasks/?all=true") {
        return Promise.resolve(jsonResponse([task, planningTask]));
      }
      if (url === "/api/v1/timer/start/")
        return Promise.resolve(timerResponse(runningEntry));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    renderApp(`/timer?project=${uid(2)}`);
    const timerSection = await screen.findByRole("region", {
      name: "Bieżący timer",
    });

    expect(within(timerSection).getByLabelText("Projekt")).toHaveValue(uid(2));
    // Opening each title field lists only the chosen project's tasks.
    await user.click(within(timerSection).getByLabelText("Zadanie"));
    expect(
      screen.getByRole("option", { name: "Plan release" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Prepare outline" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wpis ręczny" }));
    const manualEntry = screen.getByRole("dialog", {
      name: "Dodaj wpis ręcznie",
    });
    expect(within(manualEntry).getByLabelText("Projekt")).toHaveValue(uid(2));
    await user.click(within(manualEntry).getByLabelText("Zadanie"));
    expect(
      screen.getByRole("option", { name: "Plan release" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Prepare outline" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(manualEntry).getByRole("button", { name: "Anuluj" }),
    );

    await user.type(
      within(timerSection).getByLabelText("Zadanie"),
      planningTask.title,
    );
    await user.click(
      within(timerSection).getByRole("button", { name: "Rozpocznij timer" }),
    );

    expect(
      await screen.findByRole("button", { name: "Zatrzymaj timer" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/timer/start/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: planningTask.title }),
      }),
    );
  });

  test("user can start a timer from a task row and stop it on the timer page", async () => {
    const runningEntry = {
      id: uid(5),
      task_id: task.id,
      start: `${daysAgoKey(0)}T12:00:00Z`,
      end: null,
    };
    const stoppedEntry = { ...runningEntry, end: `${daysAgoKey(0)}T12:30:00Z` };
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      // Starting answers with the timer, so the timer page does not ask again.
      .mockResolvedValueOnce(timerResponse(runningEntry))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(stoppedEntry))
      .mockResolvedValueOnce(jsonResponse([stoppedEntry]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await user.click(
      await screen.findByRole("button", {
        name: "Uruchom timer: Prepare outline",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Czas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Bieżący timer" }),
    ).toHaveTextContent("Prepare outline");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/timer/start/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ task: task.id }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Zatrzymaj timer" }));

    expect(
      await screen.findByRole("button", { name: "Rozpocznij timer" }),
    ).toBeInTheDocument();
    expect(
      (
        await screen.findByRole("button", {
          name: "Edytuj wpis: Prepare outline",
        })
      ).closest("li"),
    ).toHaveTextContent("30 min");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/time-entries/",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("the timer and manual entry forms suggest titles of past entries", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    titlesMock.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.includes("search=Wee")
            ? [{ title: "Weekly report", last_used: "2026-10-14T09:00:00Z" }]
            : [],
        ),
      ),
    );
    const user = userEvent.setup();

    renderApp("/timer");
    const timerSection = await screen.findByRole("region", {
      name: "Bieżący timer",
    });
    await user.type(within(timerSection).getByLabelText("Zadanie"), "Wee");

    // The open list is portalled to <body>; only one is open at a time.
    const suggested = () => {
      const list = screen.queryByRole("listbox");
      return list
        ? within(list)
            .getAllByRole("option")
            .map((option) => option.textContent)
        : [];
    };
    await waitFor(() => expect(suggested()).toEqual(["Weekly report"]));
    expect(titlesMock).toHaveBeenCalledWith(
      "/api/v1/time-entries/titles/?search=Wee",
    );

    await user.click(screen.getByRole("option", { name: "Weekly report" }));
    expect(within(timerSection).getByLabelText("Zadanie")).toHaveValue(
      "Weekly report",
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wpis ręczny" }));
    const manualEntry = screen.getByRole("dialog", {
      name: "Dodaj wpis ręcznie",
    });
    await user.type(within(manualEntry).getByLabelText("Zadanie"), "Wee");
    await waitFor(() => expect(suggested()).toEqual(["Weekly report"]));
  });

  test("the running timer ticks every second", async () => {
    vi.useFakeTimers();
    try {
      const runningEntry = {
        id: uid(5),
        task_id: task.id,
        start: "2026-10-15T12:00:00Z",
        end: null,
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse([inbox]))
        .mockResolvedValueOnce(jsonResponse([task]))
        .mockResolvedValueOnce(timerResponse(runningEntry))
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse([task]));
      renderApp("/tasks");
      await vi.waitFor(() =>
        expect(screen.getByText("Prepare outline")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("link", { name: "Czas" }));

      await vi.waitFor(() =>
        expect(screen.getByText("0:00:00")).toBeInTheDocument(),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(screen.queryByText("0:00:00")).not.toBeInTheDocument();
      expect(screen.getByText(/^0:00:0[1-9]$/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test("user can add a manual entry and sees it under today with the day’s total", async () => {
    const created = entryPayload(uid(6), daysAgoKey(0), "08:00:00", "08:45:00");
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(jsonResponse(created, 201))
      .mockResolvedValueOnce(jsonResponse([created]))
      .mockResolvedValueOnce(jsonResponse([task]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await screen.findByText("Prepare outline");
    await user.click(screen.getByRole("link", { name: "Czas" }));
    await user.click(
      await screen.findByRole("button", { name: "Wpis ręczny" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Dodaj wpis ręcznie" });
    await user.type(within(dialog).getByLabelText("Zadanie"), task.title);
    await user.type(within(dialog).getByLabelText("Czas (minuty)"), "45");
    await user.click(
      within(dialog).getByRole("button", { name: "Dodaj wpis" }),
    );

    const today = await screen.findByRole("region", { name: /^Dziś · / });
    expect(
      within(today).getByRole("button", {
        name: "Edytuj wpis: Prepare outline",
      }),
    ).toBeInTheDocument();
    // The day's total and the entry's own length.
    expect(within(today).getAllByText("45 min")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Ostatnie 7 dni" }),
    ).toHaveTextContent("45 min");
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "/api/v1/time-entries/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: task.title,
          date: daysAgoKey(0),
          duration_minutes: 45,
        }),
      }),
    );
  });

  test("user can edit and delete an entry", async () => {
    const original = entryPayload(
      uid(6),
      daysAgoKey(0),
      "08:00:00",
      "08:45:00",
    );
    const updated = entryPayload(uid(6), daysAgoKey(0), "08:00:00", "09:00:00");
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([original]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(jsonResponse(updated))
      .mockResolvedValueOnce(jsonResponse([updated]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await screen.findByText("Prepare outline");
    await user.click(screen.getByRole("link", { name: "Czas" }));
    await screen.findByRole("button", { name: "Edytuj wpis: Prepare outline" });

    await user.click(
      screen.getByRole("button", { name: "Edytuj wpis: Prepare outline" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Czas (minuty)"));
    await user.type(within(dialog).getByLabelText("Czas (minuty)"), "60");
    await user.click(
      within(dialog).getByRole("button", { name: "Zapisz zmiany" }),
    );

    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Edytuj wpis: Prepare outline" })
          .closest("li"),
      ).toHaveTextContent("1 h"),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `/api/v1/time-entries/${original.id}/`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          title: task.title,
          date: daysAgoKey(0),
          duration_minutes: 60,
        }),
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Edytuj wpis: Prepare outline" }),
    );
    await user.click(await screen.findByRole("button", { name: "Edytuj" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );

    await screen.findByText(
      "Nie ma jeszcze wpisów. Uruchom timer albo dodaj wpis ręcznie.",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      `/api/v1/time-entries/${original.id}/`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("user can discard the running timer so nothing is saved", async () => {
    const runningEntry = {
      id: uid(5),
      task_id: task.id,
      start: "2026-10-15T12:00:00Z",
      end: null,
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(runningEntry))
      .mockResolvedValueOnce(jsonResponse([runningEntry]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse([]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await screen.findByText("Prepare outline");
    await user.click(screen.getByRole("link", { name: "Czas" }));
    await screen.findByRole("button", { name: "Zatrzymaj timer" });

    expect(
      screen.queryByRole("button", { name: "Edytuj wpis: Prepare outline" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Odrzuć timer" }));

    expect(
      await screen.findByRole("button", { name: "Rozpocznij timer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nie ma jeszcze wpisów. Uruchom timer albo dodaj wpis ręcznie.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      `/api/v1/time-entries/${runningEntry.id}/`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("the Dziennik groups entries by day with totals and the last seven days", async () => {
    const todayFirst = entryPayload(
      uid(6),
      daysAgoKey(0),
      "08:00:00",
      "08:30:00",
    );
    const todaySecond = entryPayload(
      uid(7),
      daysAgoKey(0),
      "10:00:00",
      "10:45:00",
    );
    const yesterday = entryPayload(
      uid(8),
      daysAgoKey(1),
      "09:00:00",
      "10:30:00",
    );
    fetchMock
      .mockResolvedValueOnce(jsonResponse([inbox]))
      .mockResolvedValueOnce(jsonResponse([task]))
      .mockResolvedValueOnce(timerResponse(null))
      .mockResolvedValueOnce(jsonResponse([todayFirst, todaySecond, yesterday]))
      .mockResolvedValueOnce(jsonResponse([task]));
    const user = userEvent.setup();

    renderApp("/tasks");
    await screen.findByText("Prepare outline");
    await user.click(screen.getByRole("link", { name: "Czas" }));

    const today = await screen.findByRole("region", { name: /^Dziś · / });
    expect(today).toHaveTextContent("1 h 15 min");
    expect(
      within(today).getAllByRole("button", { name: /^Edytuj wpis:/ }),
    ).toHaveLength(2);
    expect(within(today).getAllByText("Inbox")).toHaveLength(2);
    const before = screen.getByRole("region", { name: /^Wczoraj · / });
    expect(within(before).getAllByText("1 h 30 min")).toHaveLength(2);
    const week = screen.getByRole("region", { name: "Ostatnie 7 dni" });
    expect(week).toHaveTextContent("2 h 45 min");
    expect(week).toHaveTextContent(`${daysAgoKey(1)}: 1 h 30 min`);
  });

  test("older days stay hidden until the user asks for them", async () => {
    const recent = entryPayload(uid(6), daysAgoKey(2), "08:00:00", "08:30:00");
    const old = {
      ...entryPayload(uid(7), daysAgoKey(20), "08:00:00", "09:00:00"),
      task_id: null,
      title: "Old work",
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([recent, old]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    renderApp("/timer");
    await screen.findByRole("button", { name: "Edytuj wpis: Prepare outline" });
    expect(
      screen.queryByRole("button", { name: "Edytuj wpis: Old work" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pokaż starsze" }));

    expect(
      screen.getByRole("button", { name: "Edytuj wpis: Old work" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pokaż starsze" }),
    ).not.toBeInTheDocument();
  });

  test("resuming restarts a Task's entry on the Task and a titled one on its title", async () => {
    const onTask = entryPayload(uid(6), daysAgoKey(0), "08:00:00", "08:30:00");
    const titled = {
      ...entryPayload(uid(7), daysAgoKey(0), "09:00:00", "09:20:00"),
      task_id: null,
      title: "Code review",
    };
    const running = {
      id: uid(9),
      task_id: null,
      title: "Code review",
      start: `${daysAgoKey(0)}T12:00:00Z`,
      end: null,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([onTask, titled]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task]));
      if (url === "/api/v1/timer/start/")
        return Promise.resolve(timerResponse(running));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    renderApp("/timer");
    await user.click(
      await screen.findByRole("button", { name: "Wznów: Prepare outline" }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/timer/start/",
      expect.objectContaining({ body: JSON.stringify({ task: task.id }) }),
    );

    await user.click(
      screen.getByRole("button", { name: "Wznów: Code review" }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/timer/start/",
      expect.objectContaining({
        body: JSON.stringify({ title: "Code review" }),
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Zatrzymaj timer" }),
    ).toBeInTheDocument();
  });

  test("Statystyki show the month's total and the split by project", async () => {
    const planning = {
      id: uid(2),
      name: "Planning",
      description: "",
      is_inbox: false,
      project_statuses: ["Todo"],
      terminal_status: "Todo",
    };
    const planningTask = {
      ...task,
      id: uid(8),
      title: "Plan release",
      project_id: planning.id,
    };
    const first = entryPayload(uid(6), daysAgoKey(0), "08:00:00", "09:00:00");
    const second = {
      ...entryPayload(uid(7), daysAgoKey(0), "10:00:00", "10:30:00"),
      task_id: planningTask.id,
    };
    const loose = {
      ...entryPayload(uid(8), daysAgoKey(0), "11:00:00", "11:15:00"),
      task_id: null,
      title: "Email",
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox, planning]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([first, second, loose]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task, planningTask]));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    renderApp("/timer");
    await user.click(await screen.findByRole("link", { name: "Statystyki" }));

    expect(
      await screen.findByRole("button", { name: "Miesiąc" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Łącznie").parentElement).toHaveTextContent(
      "1 h 45 min",
    );
    const byProject = screen.getByRole("region", { name: "Według projektu" });
    expect(byProject).toHaveTextContent("Inbox1 h · 57%");
    expect(byProject).toHaveTextContent("Planning30 min · 29%");
    expect(byProject).toHaveTextContent("Bez projektu15 min · 14%");
    expect(
      screen.getByRole("region", { name: "Najwięcej czasu na" }),
    ).toHaveTextContent("Prepare outline");
    expect(
      screen.queryByRole("region", { name: "Bieżący timer" }),
    ).not.toBeInTheDocument();

    // Back a year: nothing was logged then.
    await user.click(screen.getByRole("button", { name: "Rok" }));
    await user.click(screen.getByRole("button", { name: "Poprzedni okres" }));
    expect(
      screen.getAllByText("Brak wpisów w tym okresie.").length,
    ).toBeGreaterThan(0);
  });

  test("user can start a timer without a project and gets every project’s titles as suggestions", async () => {
    const planning = {
      id: uid(2),
      name: "Planning",
      description: "",
      is_inbox: false,
    };
    const planningTask = {
      ...task,
      id: uid(8),
      title: "Plan release",
      project_id: planning.id,
    };
    const runningEntry = {
      id: uid(5),
      task_id: null,
      title: "Plan release",
      start: "2026-10-15T12:00:00Z",
      end: null,
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox, planning]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task, planningTask]));
      if (url === "/api/v1/timer/start/")
        return Promise.resolve(timerResponse(runningEntry));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    renderApp("/timer");
    const timerSection = await screen.findByRole("region", {
      name: "Bieżący timer",
    });
    await user.selectOptions(
      within(timerSection).getByLabelText("Projekt"),
      "Bez projektu",
    );

    await user.click(within(timerSection).getByLabelText("Zadanie"));
    const suggestions = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(suggestions).toEqual(["Prepare outline", "Plan release"]);

    await user.type(
      within(timerSection).getByLabelText("Zadanie"),
      "Plan release",
    );
    await user.click(
      within(timerSection).getByRole("button", { name: "Rozpocznij timer" }),
    );

    expect(
      await screen.findByRole("button", { name: "Zatrzymaj timer" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/timer/start/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Plan release" }),
      }),
    );
  });

  test("user can start a timer with a time limit", async () => {
    const runningEntry = {
      id: uid(5),
      task_id: null,
      title: "Deep work",
      start: "2026-10-15T12:00:00Z",
      end: null,
      planned_end: "2026-10-15T12:25:00Z",
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === "/api/v1/projects/")
        return Promise.resolve(jsonResponse([inbox]));
      if (url === "/api/v1/timer/") return Promise.resolve(timerResponse(null));
      if (url === "/api/v1/time-entries/")
        return Promise.resolve(jsonResponse([]));
      if (url === "/api/v1/tasks/?all=true")
        return Promise.resolve(jsonResponse([task]));
      if (url === "/api/v1/timer/start/")
        return Promise.resolve(timerResponse(runningEntry));
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const user = userEvent.setup();

    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal(
      "Notification",
      Object.assign(vi.fn(), { permission: "default", requestPermission }),
    );

    renderApp("/timer");
    const timerSection = await screen.findByRole("region", {
      name: "Bieżący timer",
    });
    await user.type(
      within(timerSection).getByLabelText("Zadanie"),
      "Deep work",
    );
    await user.selectOptions(
      within(timerSection).getByLabelText("Limit czasu"),
      "25 min",
    );
    await user.click(
      within(timerSection).getByRole("button", { name: "Rozpocznij timer" }),
    );

    expect(await screen.findByText("0:25:00")).toBeInTheDocument();
    expect(screen.getByText(/^Pozostało · zatrzyma się o/)).toBeInTheDocument();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/timer/start/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Deep work", duration_minutes: 25 }),
      }),
    );
  });

  test("a limited timer counts down, stops and notifies once it runs out", async () => {
    vi.useFakeTimers();
    const notification = vi.fn();
    vi.stubGlobal(
      "Notification",
      Object.assign(notification, { permission: "granted" }),
    );
    try {
      const runningEntry = {
        id: uid(5),
        task_id: task.id,
        start: "2026-10-15T11:59:55Z",
        end: null,
        planned_end: "2026-10-15T12:00:03Z",
      };
      const stoppedEntry = { ...runningEntry, end: runningEntry.planned_end };
      let expired = false;
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "/api/v1/projects/")
          return Promise.resolve(jsonResponse([inbox]));
        if (url === "/api/v1/tasks/?all=true")
          return Promise.resolve(jsonResponse([task]));
        if (url === "/api/v1/timer/") {
          return Promise.resolve(timerResponse(expired ? null : runningEntry));
        }
        if (url === "/api/v1/time-entries/") {
          return Promise.resolve(
            jsonResponse(expired ? [stoppedEntry] : [runningEntry]),
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      renderApp("/timer");
      await vi.waitFor(() =>
        expect(screen.getByText("0:00:03")).toBeInTheDocument(),
      );

      expired = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4500);
      });

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Rozpocznij timer" }),
        ).toBeInTheDocument(),
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Czas minął: Prepare outline",
      );
      expect(notification).toHaveBeenCalledWith("Czas minął", {
        body: "Prepare outline",
        tag: "timer-finished",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a timer stopped elsewhere before its limit does not notify", async () => {
    vi.useFakeTimers();
    const notification = vi.fn();
    vi.stubGlobal(
      "Notification",
      Object.assign(notification, { permission: "granted" }),
    );
    try {
      const runningEntry = {
        id: uid(5),
        task_id: task.id,
        start: "2026-10-15T11:59:55Z",
        end: null,
        planned_end: "2026-10-15T12:00:03Z",
      };
      const stoppedEarly = { ...runningEntry, end: "2026-10-15T12:00:01Z" };
      let stopped = false;
      fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url === "/api/v1/projects/")
          return Promise.resolve(jsonResponse([inbox]));
        if (url === "/api/v1/tasks/?all=true")
          return Promise.resolve(jsonResponse([task]));
        if (url === "/api/v1/timer/")
          return Promise.resolve(timerResponse(stopped ? null : runningEntry));
        if (url === "/api/v1/time-entries/") {
          return Promise.resolve(
            jsonResponse(stopped ? [stoppedEarly] : [runningEntry]),
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      renderApp("/timer");
      await vi.waitFor(() =>
        expect(screen.getByText("0:00:03")).toBeInTheDocument(),
      );

      stopped = true;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4500);
      });

      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Rozpocznij timer" }),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(notification).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
