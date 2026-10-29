import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";
import { toThemePreference, type ThemePreference } from "../themes";

/**
 * This device's copy of the account's theme. The account's settings on the
 * server are the one source of truth (`queries/settings.ts` writes them and
 * overwrites this copy whenever they load); the copy is persisted in the
 * platform storage (localStorage on the web, secure storage on the phone) only
 * so that startup, the sign-in screens and offline use show the last known
 * theme at once instead of flashing the default. Each host resolves "system"
 * and applies the palette itself.
 */
type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: "theme",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ preference: state.preference }),
      // A theme removed since it was saved falls back to following the system.
      merge: (persisted, current) => ({
        ...current,
        preference: toThemePreference(
          (persisted as Partial<ThemeState> | undefined)?.preference,
        ),
      }),
    },
  ),
);
