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
  "projects",
  "tasks",
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
  index: { name: "index", href: "/", title: "Start", icon: "home-outline" },
  projects: {
    name: "projects",
    href: "/projects",
    title: "Projekty",
    icon: "folder-outline",
  },
  tasks: {
    name: "tasks",
    href: "/tasks",
    title: "Zadania",
    icon: "checkbox-outline",
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
    // So many tabs leave no room for the full word under the icon.
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
 * saved) go right after the tab that precedes them by default.
 */
export function normalizeOrder(saved: unknown): TabName[] {
  const known = Array.isArray(saved) ? saved.filter(isTabName) : [];
  const order = [...new Set(known)];
  tabNames.forEach((name, index) => {
    if (order.includes(name)) return;
    const previous = index > 0 ? order.indexOf(tabNames[index - 1]) : -1;
    order.splice(previous + 1, 0, name);
  });
  return order;
}

/** The saved hidden tabs this build still has, never the pinned one. */
export function normalizeHidden(saved: unknown): TabName[] {
  const known = Array.isArray(saved) ? saved.filter(isTabName) : [];
  return [...new Set(known)].filter((name) => name !== pinnedTab);
}

/**
 * Saved settings from before Start (version 0) used "index" for Projekty:
 * rename it to "projects" and put Start first, shown.
 */
export function migrateTabBar(persisted: unknown, version: number): unknown {
  if (version >= 1) return persisted;
  const saved = (persisted ?? {}) as { order?: unknown; hidden?: unknown };
  const rename = (names: unknown) =>
    Array.isArray(names)
      ? names.map((name) => (name === "index" ? "projects" : name))
      : names;
  const order = rename(saved.order);
  return {
    ...saved,
    order: Array.isArray(order) ? ["index", ...order] : order,
    hidden: rename(saved.hidden),
  };
}

/**
 * Which bottom tabs are shown, and in what order. `order` is remembered on
 * this device; `hidden` is this device's copy of the account's mobile
 * settings, whose source of truth is the server (see `queries/mobileSettings`).
 * Rehydrated in `app/_layout.tsx` once setup has pointed `platformStorage`
 * at secure storage.
 */
type TabBarState = {
  order: TabName[];
  hidden: TabName[];
  /** Replace the hidden tabs, dropping unknown ids and the pinned one. */
  setHidden: (hidden: unknown) => void;
  /** Swap a tab with its neighbour; `offset` is -1 (earlier) or 1 (later). */
  move: (name: TabName, offset: -1 | 1) => void;
  reset: () => void;
};

export const useTabBarStore = create<TabBarState>()(
  persist(
    (set) => ({
      order: [...tabNames],
      hidden: [],
      setHidden: (hidden) =>
        set((state) => {
          const next = normalizeHidden(hidden);
          if (
            next.length === state.hidden.length &&
            next.every((tab, index) => tab === state.hidden[index])
          ) {
            return state;
          }
          return { hidden: next };
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
      version: 1,
      migrate: migrateTabBar,
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

/** The first tab the user sees, where the app starts when Start is hidden. */
export function firstVisibleTab(order: TabName[], hidden: TabName[]): TabName {
  return order.find((name) => !hidden.includes(name)) ?? pinnedTab;
}
