import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "../platform";

export type CounterViewMode = "rows" | "tiles";

/** What a Counter tile shows large in its middle. */
export type CounterTileValue = "total" | "entries" | "streak";

/** How the calendar above the list draws the month: one grid, a row per Counter, or not at all. */
export type CounterCalendarMode = "grid" | "matrix" | "hidden";

export const COUNTER_CALENDAR_MODES: readonly CounterCalendarMode[] = [
  "grid",
  "matrix",
  "hidden",
];

export const COUNTER_VIEW_MODES: readonly CounterViewMode[] = ["rows", "tiles"];

export const COUNTER_TILE_VALUES: readonly CounterTileValue[] = [
  "total",
  "entries",
  "streak",
];

function isViewMode(value: unknown): value is CounterViewMode {
  return COUNTER_VIEW_MODES.some((mode) => mode === value);
}

function isCalendarMode(value: unknown): value is CounterCalendarMode {
  return COUNTER_CALENDAR_MODES.some((mode) => mode === value);
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
  calendar: CounterCalendarMode;
  setMode: (mode: CounterViewMode) => void;
  setTileValue: (tileValue: CounterTileValue) => void;
  setCalendar: (calendar: CounterCalendarMode) => void;
};

export const useCounterViewStore = create<CounterViewState>()(
  persist(
    (set) => ({
      mode: "rows",
      tileValue: "total",
      calendar: "grid",
      setMode: (mode) => set({ mode }),
      setTileValue: (tileValue) => set({ tileValue }),
      setCalendar: (calendar) => set({ calendar }),
    }),
    {
      name: "countersView",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({
        mode: state.mode,
        tileValue: state.tileValue,
        calendar: state.calendar,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CounterViewState> | undefined;
        return {
          ...current,
          ...(isViewMode(saved?.mode) ? { mode: saved.mode } : {}),
          ...(isTileValue(saved?.tileValue)
            ? { tileValue: saved.tileValue }
            : {}),
          ...(isCalendarMode(saved?.calendar)
            ? { calendar: saved.calendar }
            : {}),
        };
      },
    },
  ),
);
