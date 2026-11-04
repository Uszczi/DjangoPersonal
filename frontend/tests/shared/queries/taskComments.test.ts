import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { TaskResponse } from "@personal/shared/generated/api";
import { taskCommentKeys, taskKeys } from "@personal/shared/queries/keys";
import {
  commentCountLabel,
  shiftCommentCount,
} from "@personal/shared/queries/taskComments";

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

describe("shiftCommentCount", () => {
  function task(id: number, commentCount?: number): TaskResponse {
    return {
      id,
      title: `T${id}`,
      description: "",
      projectId: 1,
      status: "Todo",
      position: 0,
      commentCount,
    };
  }

  const counts = (client: QueryClient, key: readonly unknown[]) =>
    client
      .getQueryData<TaskResponse[]>(key)
      ?.map((item) => [item.id, item.commentCount]);

  it("moves one Task's count in every cached task list, and nothing else", () => {
    const client = new QueryClient();
    client.setQueryData(taskKeys.project(1), [task(1, 2), task(2, 0)]);
    client.setQueryData(taskKeys.everything, [task(1, 2), task(3)]);
    const comments = [{ id: 1, taskId: 1, body: "Kept" }];
    client.setQueryData(taskCommentKeys.task(1), comments);

    shiftCommentCount(client, 1, 1);

    expect(counts(client, taskKeys.project(1))).toEqual([
      [1, 3],
      [2, 0],
    ]);
    expect(counts(client, taskKeys.everything)).toEqual([
      [1, 3],
      [3, undefined],
    ]);
    expect(client.getQueryData(taskCommentKeys.task(1))).toBe(comments);
  });

  it("starts a missing count at zero and never goes below it", () => {
    const client = new QueryClient();
    client.setQueryData(taskKeys.everything, [task(1), task(2, 0)]);

    shiftCommentCount(client, 1, 1);
    shiftCommentCount(client, 2, -1);

    expect(counts(client, taskKeys.everything)).toEqual([
      [1, 1],
      [2, 0],
    ]);
  });
});
