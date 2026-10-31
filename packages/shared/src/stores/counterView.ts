import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

export type CounterViewMode = "rows" | "tiles";

/** What a Counter tile shows large in its middle. */
export type CounterTileValue = "total" | "entries" | "streak";

export const COUNTER_VIEW_MODES: readonly CounterViewMode[] = ["rows", "tiles"];

export const COUNTER_TILE_VALUES: readonly CounterTileValue[] = [
  "total",
  "entries",
  "streak",
];

function isViewMode(value: unknown): value is CounterViewMode {
  return COUNTER_VIEW_MODES.some((mode) => mode === value);
}

function isTileValue(value: unknown): value is CounterTileValue {
  return COUNTER_TILE_VALUES.some((option) => option === value);
}

/**
 * How the Counters list looks, remembered on this device. The mobile app
 * rehydrates it in `app/_layout.tsx` once `platformStorage` is configured.
 */
type CounterViewState = {
  mode: CounterViewMode;
  tileValue: CounterTileValue;
  setMode: (mode: CounterViewMode) => void;
  setTileValue: (tileValue: CounterTileValue) => void;
};

export const useCounterViewStore = create<CounterViewState>()(
  persist(
    (set) => ({
      mode: "rows",
      tileValue: "total",
      setMode: (mode) => set({ mode }),
      setTileValue: (tileValue) => set({ tileValue }),
    }),
    {
      name: "countersView",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ mode: state.mode, tileValue: state.tileValue }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CounterViewState> | undefined;
        return {
          ...current,
          ...(isViewMode(saved?.mode) ? { mode: saved.mode } : {}),
          ...(isTileValue(saved?.tileValue)
            ? { tileValue: saved.tileValue }
            : {}),
        };
      },
    },
  ),
);
