/**
 * Categories as server state: the list query and the writes that keep the
 * cached list in step with the server's answers.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import type { CategoryResponse } from "../generated/api";
import { categoryKeys, transactionKeys, walletKeys } from "./keys";

/** The direction of every transaction filed under a category. */
export type CategoryKind = "expense" | "income";

/** What the panel's create and edit forms collect. `kind` is set at creation
 * and never changes, so the edit form leaves it off. */
export type CategoryInput = { name: string; icon: string; kind?: CategoryKind };

/** Close enough to the server's `normalized_name` sort; a refetch reconciles edge cases. */
function compareByName(a: CategoryResponse, b: CategoryResponse): number {
  return a.name.trim().localeCompare(b.name.trim());
}

export const categoriesQuery = queryOptions({
  queryKey: categoryKeys.all,
  queryFn: ({ signal }) => api.categoriesList({ signal }),
});

export function useCategories() {
  return useQuery(categoriesQuery);
}

function upsert(queryClient: QueryClient, category: CategoryResponse) {
  queryClient.setQueryData(categoriesQuery.queryKey, (list) =>
    list
      ? [...list.filter((item) => item.id !== category.id), category].sort(
          compareByName,
        )
      : list,
  );
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      api.categoriesCreate({ categoryRequest: input }),
    onSuccess: (created) => upsert(queryClient, created),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      category,
      input,
    }: {
      category: CategoryResponse;
      input: CategoryInput;
    }) =>
      api.categoriesPartialUpdate({
        id: category.id,
        patchedCategoryRequest: input,
      }),
    onSuccess: (updated) => upsert(queryClient, updated),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category: CategoryResponse) =>
      api.categoriesDestroy({ id: category.id }),
    onSuccess: (_, category) => {
      queryClient.setQueryData(categoriesQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== category.id),
      );
      // Its transactions went with it: every cached transaction list and
      // every balance is stale.
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}
