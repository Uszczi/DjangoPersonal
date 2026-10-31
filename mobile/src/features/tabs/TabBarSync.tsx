import { useHiddenTabsSync } from "@/queries/mobileSettings";

/**
 * Copies the account's hidden tabs onto this device once signed in. Mounted
 * once, inside the root layout's query provider, next to `AccountThemeSync`.
 */
export function TabBarSync(): null {
  useHiddenTabsSync();
  return null;
}
