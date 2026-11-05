/** The Outbox: writes made offline survive a restart and are sent once online. */
import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createQueryClient } from "@personal/shared/queries/client";
import { timerWriteKeys } from "@personal/shared/queries/keys";
import {
  backlogLabel,
  restoreOutbox,
  sendWrite,
} from "@personal/shared/queries/outbox";

const OUTBOX_KEY = "personal-outbox";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

test("a write queued offline is saved, and sent after a restart", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const before = createQueryClient();
  await restoreOutbox(before);
  onlineManager.setOnline(false);

  const delivery = await sendWrite(before, timerWriteKeys.start, {
    id: "0190f5a0-0000-7000-8000-000000000001",
    title: "Offline work",
    at: new Date("2026-11-05T09:00:00Z"),
    idempotencyKey: "0190f5a0-0000-7000-8000-0000000000aa",
  });

  expect(delivery).toBe("queued");
  const saved = window.localStorage.getItem(OUTBOX_KEY) ?? "";
  expect(saved).toContain("Offline work");
  // Let the write settle into waiting, as it would before the app is closed.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(fetchMock).not.toHaveBeenCalled();

  // The app restarts online: a new client finds the write and sends it.
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ entry: null, server_now: "2026-11-05T09:30:00Z" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  before.getMutationCache().clear();
  window.localStorage.setItem(OUTBOX_KEY, saved);
  onlineManager.setOnline(true);
  const after = createQueryClient();
  await restoreOutbox(after);

  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/v1/timer/start/");
  expect(JSON.parse(String(init.body))).toEqual({
    id: "0190f5a0-0000-7000-8000-000000000001",
    title: "Offline work",
    at: "2026-11-05T09:00:00.000Z",
  });
  const headers = new Headers(init.headers);
  expect(headers.get("Idempotency-Key")).toBe(
    "0190f5a0-0000-7000-8000-0000000000aa",
  );
  expect(headers.get("Content-Type")).toBe("application/json");
  await vi.waitFor(() =>
    expect(window.localStorage.getItem(OUTBOX_KEY)).not.toContain(
      "Offline work",
    ),
  );
});

test("the backlog is counted in Polish", () => {
  expect(backlogLabel(1)).toBe("1 zmiana czeka na wysłanie");
  expect(backlogLabel(3)).toBe("3 zmiany czekają na wysłanie");
  expect(backlogLabel(5)).toBe("5 zmian czeka na wysłanie");
  expect(backlogLabel(12)).toBe("12 zmian czeka na wysłanie");
  expect(backlogLabel(22)).toBe("22 zmiany czekają na wysłanie");
});
