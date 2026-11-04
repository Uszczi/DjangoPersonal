import { describe, expect, it } from "vitest";

import { commentCountLabel } from "@personal/shared/queries/taskComments";

describe("commentCountLabel", () => {
  it.each([
    [1, "1 komentarz"],
    [2, "2 komentarze"],
    [4, "4 komentarze"],
    [5, "5 komentarzy"],
    [12, "12 komentarzy"],
    [22, "22 komentarze"],
    [0, "0 komentarzy"],
  ])("%i → %s", (count, label) => {
    expect(commentCountLabel(count)).toBe(label);
  });
});
