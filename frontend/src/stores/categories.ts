import { create } from "zustand";

import { api } from "@/api";
import { type CategoryResponse } from "@/generated/api";
import { createLoadGuard } from "@/stores/loadGuard";

/** What the panel's create and edit forms collect. */
export type CategoryInput = { name: string; icon: string };

/**
 * One comparator for optimistic ordering, so create and rename leave the list
 * in the same shape. Close enough to the server's `normalized_name` sort; a
 * reload reconciles any locale-vs-casefold edge.
 */
function compareByName(
  a: CategoryResponse,
  b: CategoryResponse,
): number {
  return a.name.trim().localeCompare(b.name.trim());
}

type CategoriesState = {
  categories: CategoryResponse[];
  isLoading: boolean;
  pageError: string;
  loadCategories: () => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<CategoryResponse>;
  updateCategory: (
    category: CategoryResponse,
    input: CategoryInput,
  ) => Promise<CategoryResponse>;
  confirmCategoryDelete: (category: CategoryResponse) => Promise<void>;
};

const loadGuard = createLoadGuard();

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],
  isLoading: true,
  pageError: "",

  loadCategories: async () => {
    const requestId = loadGuard.nextRequestId();

    try {
      const loaded = await api.categoriesList();
      if (!loadGuard.isLatest(requestId)) return;
      set({ categories: loaded, pageError: "" });
    } catch {
      if (loadGuard.isLatest(requestId)) {
        set({
          pageError:
            "Nie udało się wczytać kategorii. Odśwież stronę, aby spróbować ponownie.",
        });
      }
    } finally {
      if (loadGuard.isLatest(requestId)) set({ isLoading: false });
    }
  },

  createCategory: async (input) => {
    const created = await api.categoriesCreate({ categoryRequest: input });
    set((state) => {
      const insertAt = state.categories.findIndex(
        (item) => compareByName(item, created) > 0,
      );
      const categories = [...state.categories];
      categories.splice(
        insertAt === -1 ? categories.length : insertAt,
        0,
        created,
      );
      return { categories };
    });
    return created;
  },

  updateCategory: async (category, input) => {
    const updated = await api.categoriesPartialUpdate({
      id: category.id,
      patchedCategoryRequest: input,
    });
    set((state) => {
      const categories = state.categories.map((item) =>
        item.id === updated.id ? updated : item,
      );
      categories.sort(compareByName);
      return { categories };
    });
    return updated;
  },

  confirmCategoryDelete: async (category) => {
    await api.categoriesDestroy({ id: category.id });

    set((state) => ({
      categories: state.categories.filter((item) => item.id !== category.id),
    }));
  },
}));
