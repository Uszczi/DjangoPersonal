import { ScrollView } from "react-native";

import type { TaskResponse } from "@personal/shared/generated/api";

import { ChipGroup } from "@/ui/ChipGroup";

type TitleSuggestionsProps = {
  tasks: TaskResponse[];
  /** Titles of past time entries, offered before the tasks'. */
  pastTitles?: string[];
  /** What is typed so far; narrows the suggestions. */
  query: string;
  onPick: (title: string) => void;
  disabled?: boolean;
};

const MAX_SUGGESTIONS = 12;

/**
 * Titles to pick instead of typing, standing in for the web's
 * `<datalist>`. A time entry is matched to a Task by its title.
 */
export function TitleSuggestions({
  tasks,
  pastTitles = [],
  query,
  onPick,
  disabled,
}: TitleSuggestionsProps) {
  const needle = query.trim().toLocaleLowerCase();
  const titles = [
    ...new Set([...pastTitles, ...tasks.map((task) => task.title)]),
  ]
    .filter(
      (title) =>
        title.toLocaleLowerCase().includes(needle) && title !== query.trim(),
    )
    .slice(0, MAX_SUGGESTIONS);
  if (titles.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <ChipGroup
        options={titles.map((title) => ({ value: title, label: title }))}
        value={undefined}
        onChange={onPick}
        disabled={disabled}
        nowrap
      />
    </ScrollView>
  );
}
