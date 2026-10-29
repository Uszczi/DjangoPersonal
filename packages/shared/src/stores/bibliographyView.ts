import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

/** `items`: one row per BibliographyItem; `years`: one row per Attempt under its year. */
export type BibliographyViewMode = "items" | "years";

/**
 * How the Bibliografia list is laid out, remembered on this device. The mobile
 * app rehydrates it in `app/_layout.tsx` once `platformStorage` is configured.
 */
type BibliographyViewState = {
  mode: BibliographyViewMode;
  setMode: (mode: BibliographyViewMode) => void;
};

export const useBibliographyViewStore = create<BibliographyViewState>()(
  persist(
    (set) => ({
      mode: "items",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "bibliographyView",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ mode: state.mode }),
      merge: (persisted, current) => {
        const mode = (persisted as Partial<BibliographyViewState> | undefined)
          ?.mode;
        return mode === "items" || mode === "years"
          ? { ...current, mode }
          : current;
      },
    },
  ),
);
