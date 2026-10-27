import { create } from "zustand";

/**
 * The remembered Project is restored on the first bare visit to Tasks in a
 * session only, so a later bare visit (e.g. browser back) shows the default.
 */
type ProjectSelectionState = {
  isRememberedProjectRestored: boolean;
  markRememberedProjectRestored: () => void;
};

export const useProjectSelectionStore = create<ProjectSelectionState>(
  (set) => ({
    isRememberedProjectRestored: false,
    markRememberedProjectRestored: () =>
      set({ isRememberedProjectRestored: true }),
  }),
);
