/**
 * Ids are UUIDv7 strings: their lowercase-hex representation sorts
 * lexicographically in creation order, so a plain string comparison is the
 * same tie-breaker the server's `order_by(...id)` uses.
 */

/** Negative when `a` was created before `b`. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whether `value` is a UUID, the shape of every entity id. */
export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
