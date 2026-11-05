/** Ids made on the device are UUIDv7s like the server's, sorting by creation time. */
import { expect, test } from "vitest";

import { compareIds, isUUID, newId } from "@personal/shared/ids";

test("a new id is a version 7 UUID", () => {
  const id = newId();

  expect(isUUID(id)).toBe(true);
  expect(id[14]).toBe("7");
  expect("89ab").toContain(id[19]);
});

test("ids made later sort after earlier ones", () => {
  const earlier = newId(Date.UTC(2026, 10, 5, 9));
  const later = newId(Date.UTC(2026, 10, 5, 10));

  expect(compareIds(earlier, later)).toBeLessThan(0);
});
