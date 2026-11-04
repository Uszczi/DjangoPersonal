/** The `?project=<id>` search param shared by the views that act on one Project. */
export type ProjectSearch = { project?: string };

export function validateProjectSearch(
  search: Record<string, unknown>,
): ProjectSearch {
  return {
    project: typeof search.project === "string" ? search.project : undefined,
  };
}
