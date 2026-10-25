/** The last Project selected in the Tasks view, remembered between sessions.

Keyed per user, so two accounts on one browser do not leak selections into
each other's sessions. Values are validated against the loaded project list
before use, so a stale id (deleted project) simply falls back to the default.
 */

const storageKey = (userId: number) => `lastProject:${userId}`;

export function rememberProject(userId: number, projectId: number): void {
  window.localStorage.setItem(storageKey(userId), String(projectId));
}

export function rememberedProjectId(userId: number): number | null {
  const raw = window.localStorage.getItem(storageKey(userId));
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
