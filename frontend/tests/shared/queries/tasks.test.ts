import { describe, expect, it } from "vitest";

import type { TaskResponse } from "@personal/shared/generated/api";
import { moveTaskInList, orderTasks } from "@personal/shared/queries/tasks";

function task(id: number, status: string, position: number): TaskResponse {
  return {
    id,
    title: `T${id}`,
    description: "",
    projectId: 1,
    status,
    position,
  };
}

const statuses = ["Do zrobienia", "Gotowe"];
const ordered = (tasks: TaskResponse[]) =>
  orderTasks(tasks, statuses).map((item) => [
    item.id,
    item.status,
    item.position,
  ]);

describe("moveTaskInList", () => {
  const tasks = [
    task(1, "Do zrobienia", 0),
    task(2, "Do zrobienia", 1),
    task(3, "Do zrobienia", 2),
    task(4, "Gotowe", 0),
  ];

  it("moves a Task within its status and renumbers the positions", () => {
    expect(ordered(moveTaskInList(tasks, tasks[2], 0))).toEqual([
      [3, "Do zrobienia", 0],
      [1, "Do zrobienia", 1],
      [2, "Do zrobienia", 2],
      [4, "Gotowe", 0],
    ]);
    expect(ordered(moveTaskInList(tasks, tasks[0], 2))).toEqual([
      [2, "Do zrobienia", 0],
      [3, "Do zrobienia", 1],
      [1, "Do zrobienia", 2],
      [4, "Gotowe", 0],
    ]);
  });

  it("moves a Task into another status, clamping the position", () => {
    expect(ordered(moveTaskInList(tasks, tasks[1], 9, "Gotowe"))).toEqual([
      [1, "Do zrobienia", 0],
      [3, "Do zrobienia", 2],
      [4, "Gotowe", 0],
      [2, "Gotowe", 1],
    ]);
  });
});
