/** The longest Task title the API accepts (`MAX_TASK_TITLE_LENGTH` in the backend). */
export const TASK_TITLE_MAX_LENGTH = 1000;

/** How much of a long title the lists show; the editor shows all of it. */
export const TASK_TITLE_PREVIEW_LENGTH = 300;

/** The title as the lists show it: cut after 300 characters, ending in "…". */
export function shortTaskTitle(title: string): string {
  if (title.length <= TASK_TITLE_PREVIEW_LENGTH) return title;
  return `${title.slice(0, TASK_TITLE_PREVIEW_LENGTH).trimEnd()}…`;
}
