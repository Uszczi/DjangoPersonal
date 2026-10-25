/** Browser notifications for a timer whose limit ran out (web only). */

function isSupported(): boolean {
  return typeof Notification !== "undefined";
}

/** Asks once for permission; call it from a click so browsers allow the prompt. */
export function askForTimerNotifications(): void {
  if (!isSupported() || Notification.permission !== "default") return;
  try {
    // Older Safari returns nothing instead of a promise.
    void Promise.resolve(Notification.requestPermission()).catch(() => undefined);
  } catch {
    // Permission can't be requested here; the on-page message still shows.
  }
}

export function notifyTimerFinished(title: string): void {
  if (!isSupported() || Notification.permission !== "granted") return;
  try {
    new Notification("Czas minął", { body: title, tag: "timer-finished" });
  } catch {
    // Some browsers (Chrome on Android) only allow notifications from a service worker.
  }
}
