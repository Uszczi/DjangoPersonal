import { describe, expect, test } from "vitest";

import type {
  ProjectResponse,
  TaskResponse,
  TimeEntryResponse,
} from "@personal/shared/generated/api";
import {
  computeTimeStats,
  dayStreaks,
  hourTicks,
  periodBuckets,
  seriesColor,
  seriesResolver,
} from "@personal/shared/timeStats";
import {
  dayLabel,
  groupLogDays,
  lastSevenDays,
} from "@personal/shared/timeLog";

/** Local time, so the tests hold in any time zone. */
function at(day: string, time: string) {
  return new Date(`${day}T${time}`);
}

let nextId = 1;
function entry(
  day: string,
  start: string,
  end: string,
  extra: Partial<TimeEntryResponse> = {},
): TimeEntryResponse {
  return {
    id: nextId++,
    taskId: null,
    title: "Work",
    start: at(day, start),
    end: at(day, end),
    ...extra,
  };
}

function project(id: number, name = `P${id}`): ProjectResponse {
  return {
    id,
    name,
    description: "",
    isInbox: id === 1,
    projectStatuses: [],
    terminalStatus: "",
  };
}

function task(id: number, projectId: number, title = `T${id}`): TaskResponse {
  return { id, title, description: "", projectId, status: "" };
}

// Wednesday 2026-10-14, midday.
const now = at("2026-10-14", "12:00:00").getTime();

describe("periodBuckets", () => {
  test("a week runs Monday to Sunday", () => {
    const { label, buckets } = periodBuckets("week", 0, now);
    expect(buckets.map((bucket) => bucket.key)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(buckets[0].label).toBe("pn");
    expect(label).toBe("12 paź – 18 paź 2026");
  });

  test("a month has a bucket per day and a capitalised name", () => {
    const { label, buckets } = periodBuckets("month", 1, now);
    expect(label).toBe("Wrzesień 2026");
    expect(buckets).toHaveLength(30);
    expect(buckets[29].longLabel).toBe("śr, 30 wrz");
  });

  test("a year has a bucket per month", () => {
    const { label, buckets } = periodBuckets("year", 0, now);
    expect(label).toBe("2026");
    expect(buckets.map((bucket) => bucket.label)).toContain("paź");
    expect(buckets[11].to).toEqual(new Date(2027, 0, 1));
  });
});

describe("computeTimeStats", () => {
  test("totals the period by day and by project, and ranks the titles", () => {
    const projects = [project(1, "Inbox"), project(2, "Site")];
    const tasks = [task(10, 2, "Build page")];
    const entries = [
      entry("2026-10-12", "08:00:00", "09:00:00", { taskId: 10, title: "" }),
      entry("2026-10-14", "08:00:00", "08:30:00"),
      entry("2026-10-14", "09:00:00", "09:15:00", { taskId: 10, title: "" }),
      // The week before: not in this period.
      entry("2026-10-05", "08:00:00", "10:00:00"),
    ];

    const stats = computeTimeStats({
      entries,
      tasks,
      projects,
      period: "week",
      offset: 0,
      now,
    });

    expect(stats.total).toBe(105);
    expect(stats.entryCount).toBe(3);
    expect(stats.activeDays).toBe(2);
    expect(stats.periodDays).toBe(3);
    expect(stats.partial).toBe(true);
    expect(stats.series).toEqual([
      { key: "2", name: "Site", slot: 1, minutes: 75 },
      { key: "none", name: "Bez projektu", slot: -1, minutes: 30 },
    ]);
    expect(stats.buckets[2].minutes).toBe(45);
    expect(stats.buckets[2].series.map((row) => row.key)).toEqual([
      "2",
      "none",
    ]);
    expect(stats.topTitles).toEqual([
      { title: "Build page", minutes: 75 },
      { title: "Work", minutes: 30 },
    ]);
  });

  test("a period under way is compared with the same stretch of the previous one", () => {
    const entries = [
      // Previous week, Monday to Wednesday: counted (2 h).
      entry("2026-10-06", "08:00:00", "10:00:00"),
      // Previous week, Friday: past the stretch, not counted.
      entry("2026-10-09", "08:00:00", "18:00:00"),
      // This week: 3 h.
      entry("2026-10-13", "08:00:00", "11:00:00"),
    ];
    const stats = computeTimeStats({
      entries,
      tasks: [],
      projects: [],
      period: "week",
      offset: 0,
      now,
    });
    expect(stats.change).toBe(50);
  });

  test("a finished period is compared with the whole previous one; no data gives no change", () => {
    const entries = [
      entry("2026-09-10", "08:00:00", "10:00:00"),
      entry("2026-08-10", "08:00:00", "12:00:00"),
    ];
    const september = computeTimeStats({
      entries,
      tasks: [],
      projects: [],
      period: "month",
      offset: 1,
      now,
    });
    expect(september.partial).toBe(false);
    expect(september.periodDays).toBe(30);
    expect(september.change).toBe(-50);

    const august = computeTimeStats({
      entries,
      tasks: [],
      projects: [],
      period: "month",
      offset: 2,
      now,
    });
    expect(august.change).toBeNull();
  });

  test("a month with a daylight-saving change still counts its days", () => {
    const stats = computeTimeStats({
      entries: [],
      tasks: [],
      projects: [],
      period: "month",
      offset: 0,
      now: at("2026-11-05", "12:00:00").getTime(),
    });
    expect(stats.periodDays).toBe(5);
    const october = computeTimeStats({
      entries: [],
      tasks: [],
      projects: [],
      period: "month",
      offset: 1,
      now: at("2026-11-05", "12:00:00").getTime(),
    });
    expect(october.periodDays).toBe(31);
  });
});

describe("seriesResolver", () => {
  test("a Project keeps its colour slot by id; past the palette it folds into Inne projekty", () => {
    const projects = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((id) => project(id));
    const tasks = projects.map((item) => task(100 + item.id, item.id));
    const seriesOf = seriesResolver(tasks, projects);
    const onProject = (id: number) =>
      seriesOf(
        entry("2026-10-14", "08:00:00", "09:00:00", { taskId: 100 + id }),
      );

    expect(onProject(1)).toMatchObject({ key: "1", slot: 0 });
    expect(onProject(7)).toMatchObject({ key: "7", slot: 6 });
    expect(onProject(8)).toEqual({
      key: "other",
      name: "Inne projekty",
      slot: -1,
    });
    expect(seriesOf(entry("2026-10-14", "08:00:00", "09:00:00"))).toEqual({
      key: "none",
      name: "Bez projektu",
      slot: -1,
    });
  });

  test("the colours differ between light and dark, and the neutral slot is grey", () => {
    expect(seriesColor(0, "light")).not.toBe(seriesColor(0, "dark"));
    expect(seriesColor(-1, "light")).toBe("#a5b1ae");
  });
});

describe("dayStreaks", () => {
  test("counts the run reaching yesterday and the longest one", () => {
    const entries = [
      entry("2026-10-01", "08:00:00", "09:00:00"),
      entry("2026-10-02", "08:00:00", "09:00:00"),
      entry("2026-10-03", "08:00:00", "09:00:00"),
      entry("2026-10-12", "08:00:00", "09:00:00"),
      entry("2026-10-13", "08:00:00", "09:00:00"),
    ];
    expect(dayStreaks(entries, now)).toEqual({ current: 2, best: 3 });
    expect(dayStreaks([], now)).toEqual({ current: 0, best: 0 });
  });
});

describe("hourTicks", () => {
  test("rounds the axis up to whole hours in readable steps", () => {
    expect(hourTicks(0)).toEqual({ maxMinutes: 60, ticks: [0, 1] });
    expect(hourTicks(250)).toEqual({ maxMinutes: 360, ticks: [0, 2, 4, 6] });
    expect(hourTicks(80 * 60).ticks).toEqual([0, 25, 50, 75, 100]);
  });
});

describe("Dziennik", () => {
  test("groups the last days newest first and says whether older entries exist", () => {
    const entries = [
      entry("2026-10-13", "08:00:00", "08:30:00"),
      entry("2026-10-14", "08:00:00", "08:20:00"),
      entry("2026-10-14", "10:00:00", "10:40:00"),
      entry("2026-09-01", "08:00:00", "09:00:00"),
    ];
    const log = groupLogDays(entries, now, 14);
    expect(log.hasOlder).toBe(true);
    expect(log.days.map((day) => [day.key, day.minutes])).toEqual([
      ["2026-10-14", 60],
      ["2026-10-13", 30],
    ]);
    expect(log.days[0].entries[0].start).toEqual(at("2026-10-14", "10:00:00"));
    expect(groupLogDays(entries, now, 60).hasOlder).toBe(false);
  });

  test("labels today and yesterday by name", () => {
    expect(dayLabel("2026-10-14", now)).toBe("Dziś · śr, 14 paź");
    expect(dayLabel("2026-10-13", now)).toBe("Wczoraj · wt, 13 paź");
    expect(dayLabel("2026-10-11", now)).toBe("nd, 11 paź");
  });

  test("the last seven days end today", () => {
    const days = lastSevenDays(
      [entry("2026-10-08", "08:00:00", "09:00:00")],
      now,
    );
    expect(days.map((day) => day.key)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(days[0].minutes).toBe(60);
  });
});
