import { beforeEach, describe, expect, it } from "vitest";

import {
  initialNewTaskStatus,
  useNewTaskStatusStore,
} from "@personal/shared/stores/newTaskStatus";

describe("initialNewTaskStatus", () => {
  it("starts with the status the last new Task in the Project got", () => {
    expect(
      initialNewTaskStatus({ "2": "W toku" }, 2, [
        "Todo",
        "W toku",
        "Zrobione",
      ]),
    ).toBe("W toku");
  });

  it("falls back to the first status for another Project or a removed status", () => {
    const statuses = ["Todo", "Zrobione"];
    expect(initialNewTaskStatus({ "2": "W toku" }, 3, statuses)).toBe("Todo");
    expect(initialNewTaskStatus({ "2": "W toku" }, 2, statuses)).toBe("Todo");
    expect(initialNewTaskStatus({}, 2, [])).toBe("");
  });
});

describe("useNewTaskStatusStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useNewTaskStatusStore.setState(useNewTaskStatusStore.getInitialState());
  });

  it("remembers the status per Project and persists it", () => {
    useNewTaskStatusStore.getState().rememberStatus(2, "W toku");
    useNewTaskStatusStore.getState().rememberStatus(3, "Todo");

    expect(useNewTaskStatusStore.getState().lastStatusByProject).toEqual({
      "2": "W toku",
      "3": "Todo",
    });
    expect(
      JSON.parse(window.localStorage.getItem("newTaskStatus") ?? "{}").state,
    ).toEqual({ lastStatusByProject: { "2": "W toku", "3": "Todo" } });
  });
});
