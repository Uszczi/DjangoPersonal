import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { platformStorage } from "@personal/shared/platform";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** A tab of the bottom bar: its route in `app/(tabs)/` and how it is shown. */
export type TabDefinition = {
  name: TabName;
  href: Href;
  title: string;
  /** A shorter label under the icon, when the title does not fit. */
  label?: string;
  icon: IconName;
};

export const tabNames = [
  "index",
  "time",
  "expenses",
  "counters",
  "bibliography",
  "account",
] as const;

export type TabName = (typeof tabNames)[number];

/**
 * The tab that is always shown: it holds the bar's settings, so hiding it
 * would leave no way back.
 */
export const pinnedTab: TabName = "account";

export const tabDefinitions: Record<TabName, TabDefinition> = {
  index: {
    name: "index",
    href: "/",
    title: "Projekty",
    icon: "folder-outline",
  },
  time: { name: "time", href: "/time", title: "Czas", icon: "time-outline" },
  expenses: {
    name: "expenses",
    href: "/expenses",
    title: "Wydatki",
    icon: "wallet-outline",
  },
  counters: {
    name: "counters",
    href: "/counters",
    title: "Liczniki",
    icon: "stats-chart-outline",
  },
  bibliography: {
    name: "bibliography",
    href: "/bibliography",
    title: "Bibliografia",
    // Six tabs leave no room for the full word under the icon.
    label: "Biblio",
    icon: "library-outline",
  },
  account: {
    name: "account",
    href: "/account",
    title: "Konto",
    icon: "person-circle-outline",
  },
};

function isTabName(value: unknown): value is TabName {
  return (tabNames as readonly unknown[]).includes(value);
}

/**
 * Bring a saved order up to date with the tabs this build has: unknown or
 * repeated names are dropped, and tabs missing from it (added since it was
 * saved) are appended in their default place in the list.
 */
export function normalizeOrder(saved: unknown): TabName[] {
  const known = Array.isArray(saved) ? saved.filter(isTabName) : [];
  const order = [...new Set(known)];
  for (const name of tabNames) {
    if (!order.includes(name)) order.push(name);
  }
  return order;
}

/** The saved hidden tabs this build still has, never the pinned one. */
export function normalizeHidden(saved: unknown): TabName[] {
  const known = Array.isArray(saved) ? saved.filter(isTabName) : [];
  return [...new Set(known)].filter((name) => name !== pinnedTab);
}

/**
 * Which bottom tabs are shown, and in what order, remembered on this device.
 * Rehydrated in `app/_layout.tsx` once setup has pointed `platformStorage`
 * at secure storage.
 */
type TabBarState = {
  order: TabName[];
  hidden: TabName[];
  setVisible: (name: TabName, isVisible: boolean) => void;
  /** Swap a tab with its neighbour; `offset` is -1 (earlier) or 1 (later). */
  move: (name: TabName, offset: -1 | 1) => void;
  reset: () => void;
};

export const useTabBarStore = create<TabBarState>()(
  persist(
    (set) => ({
      order: [...tabNames],
      hidden: [],
      setVisible: (name, isVisible) =>
        set((state) => {
          if (name === pinnedTab) return state;
          const others = state.hidden.filter((hidden) => hidden !== name);
          return { hidden: isVisible ? others : [...others, name] };
        }),
      move: (name, offset) =>
        set((state) => {
          const index = state.order.indexOf(name);
          const target = index + offset;
          if (index < 0 || target < 0 || target >= state.order.length) {
            return state;
          }
          const order = [...state.order];
          [order[index], order[target]] = [order[target], order[index]];
          return { order };
        }),
      reset: () => set({ order: [...tabNames], hidden: [] }),
    }),
    {
      name: "tabBar",
      storage: createJSONStorage(() => platformStorage),
      partialize: (state) => ({ order: state.order, hidden: state.hidden }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<TabBarState> | undefined;
        return {
          ...current,
          order: normalizeOrder(saved?.order),
          hidden: normalizeHidden(saved?.hidden),
        };
      },
    },
  ),
);

/** The first tab the user sees, where the app starts when Projekty is hidden. */
export function firstVisibleTab(order: TabName[], hidden: TabName[]): TabName {
  return order.find((name) => !hidden.includes(name)) ?? pinnedTab;
}
