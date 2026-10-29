import { describe, expect, it } from "vitest";

import { fuzzyFilter, fuzzyScore } from "@personal/shared/fuzzy";

describe("fuzzyScore", () => {
  it("matches letters in order with gaps", () => {
    expect(fuzzyScore("lka", "Lalka")).not.toBeNull();
    expect(fuzzyScore("lkl", "Lalka")).toBeNull();
  });

  it("ignores case and Polish diacritics both ways", () => {
    expect(fuzzyScore("boleslaw", "Bolesław Prus")).not.toBeNull();
    expect(fuzzyScore("ŁÓDŹ", "lodz")).not.toBeNull();
  });

  it("needs every word of the query, in any order", () => {
    expect(fuzzyScore("prus lalka", "Lalka Bolesław Prus 1890")).not.toBeNull();
    expect(fuzzyScore("prus rejs", "Lalka Bolesław Prus 1890")).toBeNull();
  });

  it("scores letters together and at word starts higher", () => {
    const together = fuzzyScore("lal", "Lalka")!;
    const scattered = fuzzyScore("lal", "Ola i Bal")!;
    expect(together).toBeGreaterThan(scattered);
  });
});

describe("fuzzyFilter", () => {
  const titles = [
    "Ogniem i mieczem",
    "Lot nad kukułczym gniazdem",
    "Lalka",
    "Pan Tadeusz",
  ];

  it("returns everything for a blank query", () => {
    expect(fuzzyFilter(titles, "  ", (title) => title)).toEqual(titles);
  });

  it("drops non-matches", () => {
    expect(fuzzyFilter(titles, "pan", (title) => title)).toEqual([
      "Pan Tadeusz",
    ]);
  });

  it("puts the best match first, ahead of the list's order", () => {
    // "lka" sits together in "Lalka" but is scattered over the other title.
    expect(fuzzyFilter(titles, "lka", (title) => title)).toEqual([
      "Lalka",
      "Lot nad kukułczym gniazdem",
    ]);
    // Letters starting words beat letters inside one: "Lot nad Kukułczym".
    expect(fuzzyFilter(titles, "lk", (title) => title)).toEqual([
      "Lot nad kukułczym gniazdem",
      "Lalka",
    ]);
  });
});
