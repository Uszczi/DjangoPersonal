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

/** 16 random bytes: the platform's crypto when it has one, else `Math.random`. */
function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const crypto = (globalThis as { crypto?: Crypto }).crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // React Native has no Web Crypto without a polyfill. These ids name a
    // user's own rows and requests; they need to be unique, not secret.
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * A fresh UUIDv7, the shape the server gives every id (ADR 0001). The client
 * makes one to name a row before the server has seen it (a timer started
 * offline) and to key a queued request (`Idempotency-Key`).
 */
export function newId(now: number = Date.now()): string {
  const bytes = randomBytes();
  // 48-bit big-endian millisecond timestamp, then version 7 and variant 10.
  let time = now;
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
