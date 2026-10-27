/** How the Counters list is laid out, remembered between sessions in this browser.

Storage can be unavailable (private mode, blocked site data); the list then
just starts in rows and the choice lasts until the page is left.
 */

export type CounterViewMode = "rows" | "tiles";

const storageKey = "countersView";

export function rememberedCounterViewMode(): CounterViewMode {
  try {
    return window.localStorage.getItem(storageKey) === "tiles"
      ? "tiles"
      : "rows";
  } catch {
    return "rows";
  }
}

export function rememberCounterViewMode(mode: CounterViewMode): void {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // Not remembered; the current page still switches.
  }
}
