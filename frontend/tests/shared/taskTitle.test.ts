import { describe, expect, it } from "vitest";

import {
  shortTaskTitle,
  TASK_TITLE_PREVIEW_LENGTH,
} from "@personal/shared/taskTitle";

describe("shortTaskTitle", () => {
  it("keeps a title up to the preview length", () => {
    const title = "a".repeat(TASK_TITLE_PREVIEW_LENGTH);
    expect(shortTaskTitle(title)).toBe(title);
  });

  it("cuts a longer title and ends it with an ellipsis", () => {
    const title = "a".repeat(TASK_TITLE_PREVIEW_LENGTH + 1);
    expect(shortTaskTitle(title)).toBe(
      `${"a".repeat(TASK_TITLE_PREVIEW_LENGTH)}…`,
    );
  });
});
