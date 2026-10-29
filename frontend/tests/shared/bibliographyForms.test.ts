import { describe, expect, it } from "vitest";

import {
  attemptDatesError,
  parseItemNumber,
  parseProgress,
} from "@personal/shared/bibliographyForms";

describe("attemptDatesError", () => {
  it("accepts an end on or after the start", () => {
    expect(
      attemptDatesError({ startedOn: "2026-10-20", endedOn: "2026-10-20" }),
    ).toBe("");
    expect(attemptDatesError({ startedOn: "", endedOn: "2026-10-28" })).toBe(
      "",
    );
  });

  it("asks for the end date when it is missing", () => {
    expect(attemptDatesError({ startedOn: "2026-10-20", endedOn: "" })).toBe(
      "Podaj datę zakończenia.",
    );
  });

  it("rejects an end before the start", () => {
    expect(
      attemptDatesError({ startedOn: "2026-10-20", endedOn: "2026-10-19" }),
    ).toBe("Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.");
  });
});

describe("parseProgress", () => {
  it("reads a whole number within the length", () => {
    expect(parseProgress(" 170 ", 680)).toEqual({ value: 170 });
    expect(parseProgress("680", 680)).toEqual({ value: 680 });
    expect(parseProgress("9000", null)).toEqual({ value: 9000 });
  });

  it("clears the progress on an empty field", () => {
    expect(parseProgress("  ", 680)).toEqual({ value: null });
  });

  it("rejects anything but a non-negative whole number", () => {
    for (const text of ["-1", "1.5", "abc"]) {
      expect(parseProgress(text, null)).toEqual({
        error: "Postęp musi być nieujemną liczbą całkowitą.",
      });
    }
  });

  it("rejects progress past the length", () => {
    expect(parseProgress("681", 680)).toEqual({
      error: "Postęp nie może przekraczać długości (680).",
    });
  });
});

describe("parseItemNumber", () => {
  it("reads an empty field as unknown and a positive whole number as itself", () => {
    expect(parseItemNumber("")).toBeNull();
    expect(parseItemNumber(" 1890 ")).toBe(1890);
  });

  it("marks zero, negatives and fractions invalid", () => {
    for (const text of ["0", "-3", "2.5", "x"]) {
      expect(parseItemNumber(text)).toBeUndefined();
    }
  });
});
