/**
 * Test ids shaped like the server's UUIDs. `uid(7)` is
 * `00000000-0000-7000-8000-000000000007`: a valid UUID that sorts like the
 * number it was made from, so fixtures keep the order their numbers implied.
 */
export function uid(n: number): string {
  return `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

/** A pattern matching one UUID, for routing mocked request paths. */
export const UID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
