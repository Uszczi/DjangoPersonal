/** The last Project selected in the Tasks view, remembered between sessions.

Keyed per user, so two accounts on one browser do not leak selections into
each other's sessions. Values are validated against the loaded project list
before use, so a stale id (deleted project) simply falls back to the default.
 */

import { isUUID } from "@personal/shared/ids";

const storageKey = (userId: string) => `lastProject:${userId}`;

export function rememberProject(userId: string, projectId: string): void {
  window.localStorage.setItem(storageKey(userId), projectId);
}

export function rememberedProjectId(userId: string): string | null {
  const raw = window.localStorage.getItem(storageKey(userId));
  // A value saved by the pre-UUID app (an integer) is not an id any more.
  if (raw === null || !isUUID(raw)) return null;
  return raw;
}
