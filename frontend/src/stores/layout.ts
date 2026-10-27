import { create } from "zustand";
import { persist } from "zustand/middleware";

type LayoutState = {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** The Notatnik file tree beside an open Notatka or Tablica. */
  isNotatnikSidebarCollapsed: boolean;
  toggleNotatnikSidebar: () => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) =>
        set({ isSidebarCollapsed: collapsed }),
      isNotatnikSidebarCollapsed: false,
      toggleNotatnikSidebar: () =>
        set((state) => ({
          isNotatnikSidebarCollapsed: !state.isNotatnikSidebarCollapsed,
        })),
    }),
    { name: "djangopersonal.layout" },
  ),
);
