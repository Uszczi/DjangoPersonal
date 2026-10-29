import { describe, expect, it } from "vitest";

import { attemptYear, groupByYear } from "@personal/shared/bibliographyYears";
import type {
  AttemptResponse,
  BibliographyItemResponse,
} from "@personal/shared/generated/api";

function item(id: number, title: string): BibliographyItemResponse {
  return {
    id,
    kind: "film",
    title,
    creator: "",
    year: null,
    length: null,
    note: "",
    status: "planned",
    createdAt: new Date("2026-01-01T10:00:00Z"),
  };
}

function attempt(
  id: number,
  itemId: number,
  fields: Partial<AttemptResponse> = {},
): AttemptResponse {
  return {
    id,
    itemId,
    outcome: "finished",
    startedOn: null,
    endedOn: null,
    progress: null,
    createdAt: new Date("2024-06-01T10:00:00Z"),
    ...fields,
  };
}

const day = (value: string) => new Date(value);

describe("attemptYear", () => {
  it("is the end date's year, else the start's, else when it was recorded", () => {
    expect(
      attemptYear(
        attempt(1, 1, {
          startedOn: day("2025-12-30"),
          endedOn: day("2026-01-02"),
        }),
      ),
    ).toBe(2026);
    expect(
      attemptYear(
        attempt(1, 1, { outcome: "in_progress", startedOn: day("2025-12-30") }),
      ),
    ).toBe(2025);
    expect(attemptYear(attempt(1, 1, { outcome: "in_progress" }))).toBe(2024);
  });
});

describe("groupByYear", () => {
  const rejs = item(1, "Rejs");
  const mis = item(2, "Miś");
  const lalka = item(3, "Lalka");

  it("lists every Attempt under its year, newest first, planned items on top", () => {
    const groups = groupByYear(
      [lalka, mis, rejs],
      [
        attempt(10, rejs.id, { endedOn: day("2025-03-01") }),
        attempt(11, mis.id, { endedOn: day("2026-01-05") }),
        attempt(12, rejs.id, { endedOn: day("2026-04-01") }),
      ],
    );

    expect(
      groups.map((group) => [
        group.label,
        group.rows.map((row) => [row.item.title, row.attempt?.id ?? null]),
      ]),
    ).toEqual([
      ["Planowane", [["Lalka", null]]],
      [
        "2026",
        [
          ["Rejs", 12],
          ["Miś", 11],
        ],
      ],
      ["2025", [["Rejs", 10]]],
    ]);
  });

  it("puts an Attempt in progress before one ended the same day", () => {
    const groups = groupByYear(
      [rejs, mis],
      [
        attempt(10, rejs.id, { endedOn: day("2026-04-01") }),
        attempt(11, mis.id, {
          outcome: "in_progress",
          startedOn: day("2026-04-01"),
        }),
      ],
    );

    expect(groups[0].rows.map((row) => row.item.title)).toEqual([
      "Miś",
      "Rejs",
    ]);
  });

  it("leaves out Attempts of items not shown and has no empty groups", () => {
    const groups = groupByYear(
      [rejs],
      [
        attempt(10, rejs.id, { endedOn: day("2025-03-01") }),
        attempt(11, mis.id, { endedOn: day("2026-01-05") }),
      ],
    );

    expect(groups.map((group) => group.key)).toEqual(["2025"]);
    expect(groupByYear([], [])).toEqual([]);
  });
});
