import { beforeEach, describe, expect, it } from "vitest";

import { queryClient } from "@/queryClient";
import { useAuthStore } from "@personal/shared/stores/auth";

const KEY = ["transactions", "wallet", 1];

function signIn(id: number, username: string) {
  useAuthStore.setState({
    user: { id, username },
    access: `access-${id}`,
    refresh: `refresh-${id}`,
  });
}

describe("the server-state cache", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    signIn(1, "alice");
    queryClient.setQueryData(KEY, ["alice’s transaction"]);
  });

  it("is emptied on logout", () => {
    useAuthStore.getState().logout();

    expect(queryClient.getQueryData(KEY)).toBeUndefined();
  });

  it("is emptied when another account signs in", () => {
    signIn(2, "bob");

    expect(queryClient.getQueryData(KEY)).toBeUndefined();
  });

  it("survives a token refresh", () => {
    useAuthStore.getState().applyTokens("fresh-access");

    expect(queryClient.getQueryData(KEY)).toEqual(["alice’s transaction"]);
  });
});
