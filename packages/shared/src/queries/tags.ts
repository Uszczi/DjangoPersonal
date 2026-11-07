/**
 * The user's Tags as server state: the list query and the writes that keep
 * the cached list in step. A Task carries its Tags' ids (`TaskResponse.tags`);
 * the names and colours come from this list.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../api";
import { COLORS } from "../colors";
import type { TagResponse, TaskResponse } from "../generated/api";
import { tagKeys, taskKeys } from "./keys";

export type TagInput = { name: string; color: string };

/** Close enough to the server's case-insensitive sort; a refetch reconciles edge cases. */
function compareByName(a: TagResponse, b: TagResponse): number {
  return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
}

export const tagsQuery = queryOptions({
  queryKey: tagKeys.all,
  queryFn: ({ signal }) => api.tagsList({ signal }),
});

export function useTags() {
  return useQuery(tagsQuery);
}

/** The Task's Tags that still exist, in the list's order. */
export function tagsOfTask(
  task: Pick<TaskResponse, "tags">,
  tags: TagResponse[],
): TagResponse[] {
  const ids = new Set(task.tags ?? []);
  return tags.filter((tag) => ids.has(tag.id));
}

/** The colour for a new Tag: the palette's next one after those already used. */
export function nextTagColor(tags: TagResponse[]): string {
  return COLORS[tags.length % COLORS.length].value;
}

/** The existing Tag named `name`, ignoring case and surrounding spaces. */
export function findTagByName(
  tags: TagResponse[],
  name: string,
): TagResponse | undefined {
  const key = name.trim().toLocaleLowerCase("pl");
  return tags.find((tag) => tag.name.toLocaleLowerCase("pl") === key);
}

function upsert(queryClient: QueryClient, tag: TagResponse) {
  queryClient.setQueryData(tagsQuery.queryKey, (list) =>
    list
      ? [...list.filter((item) => item.id !== tag.id), tag].sort(compareByName)
      : list,
  );
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TagInput) => api.tagsCreate({ tagRequest: input }),
    onSuccess: (created) => upsert(queryClient, created),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tag, input }: { tag: TagResponse; input: Partial<TagInput> }) =>
      api.tagsPartialUpdate({ id: tag.id, patchedTagRequest: input }),
    onSuccess: (updated) => upsert(queryClient, updated),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tag: TagResponse) => api.tagsDestroy({ id: tag.id }),
    onSuccess: (_, tag) => {
      queryClient.setQueryData(tagsQuery.queryKey, (list) =>
        list?.filter((item) => item.id !== tag.id),
      );
      // The Tag came off every Task; the cached Tasks still name it.
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
