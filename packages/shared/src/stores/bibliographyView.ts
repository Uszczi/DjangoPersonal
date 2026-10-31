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
  /** Whether the year view splits its rows by year and month. */
  dividers: boolean;
  setMode: (mode: BibliographyViewMode) => void;
  setDividers: (dividers: boolean) => void;
};

export const useBibliographyViewStore = create<BibliographyViewState>()(
  persist(
    (set) => ({
      mode: "items",
      dividers: true,
      setMode: (mode) => set({ mode }),
      setDividers: (dividers) => set({ dividers }),
    }),
    {
      name: "bibliographyView",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ mode: state.mode, dividers: state.dividers }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<BibliographyViewState> | undefined;
        return {
          ...current,
          ...(saved?.mode === "items" || saved?.mode === "years"
            ? { mode: saved.mode }
            : {}),
          ...(typeof saved?.dividers === "boolean"
            ? { dividers: saved.dividers }
            : {}),
        };
      },
    },
  ),
);
