import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";
import { themes, type ThemePreference } from "../themes";

/**
 * The theme the user picked on this device. Client state, persisted in the
 * platform storage (localStorage on the web, secure storage on the phone);
 * each host resolves "system" and applies the palette itself.
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
      merge: (persisted, current) => {
        const preference = (persisted as Partial<ThemeState> | undefined)
          ?.preference;
        const isKnown = preference === "system" || (preference ?? "") in themes;
        return isKnown && preference ? { ...current, preference } : current;
      },
    },
  ),
);
