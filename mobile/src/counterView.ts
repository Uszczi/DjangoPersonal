import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "@personal/shared/platform";

export type CounterViewMode = "rows" | "tiles";

/**
 * How the Counters tab lays out the list, remembered on this device (the
 * web keeps the same choice in localStorage). Rehydrated in `app/_layout.tsx`
 * once setup has pointed `platformStorage` at secure storage.
 */
type CounterViewState = {
  mode: CounterViewMode;
  setMode: (mode: CounterViewMode) => void;
};

export const useCounterViewStore = create<CounterViewState>()(
  persist(
    (set) => ({
      mode: "rows",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "countersView",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ mode: state.mode }),
      merge: (persisted, current) => {
        const mode = (persisted as Partial<CounterViewState> | undefined)?.mode;
        return mode === "tiles" || mode === "rows"
          ? { ...current, mode }
          : current;
      },
    },
  ),
);
