import Ionicons from "@expo/vector-icons/Ionicons";
import { FlatList, Pressable, Text, View } from "react-native";

import { folderPath } from "@personal/shared/folderTree";
import { useFolders } from "@personal/shared/queries/folders";
import { findMatches } from "@personal/shared/textSearch";
import { useNotatnikSearch } from "@personal/shared/useNotatnikSearch";

import { useTheme } from "@/theme";
import { common } from "@/ui/classes";

import { isNote, openItem } from "@/features/notes/navigation";

/** How many matching lines a result shows before "i N więcej", as on the web. */
const LINES_SHOWN = 3;

/** `text` with the search's matches marked. */
function Marked({ text, query }: { text: string; query: string }) {
  const parts: (string | { match: string; at: number })[] = [];
  let last = 0;
  for (const { start, end } of findMatches(text, query)) {
    parts.push(text.slice(last, start), {
      match: text.slice(start, end),
      at: start,
    });
    last = end;
  }
  parts.push(text.slice(last));
  return parts.map((part) =>
    typeof part === "string" ? (
      part
    ) : (
      <Text key={part.at} className="bg-search-match">
        {part.match}
      </Text>
    ),
  );
}

/**
 * The server's search of the whole Notatnik: names, and the lines of each
 * Notatka's text that match. A Notatka opens with the search marked in it.
 */
export function SearchResults({ query }: { query: string }) {
  const { colors } = useTheme();
  const search = useNotatnikSearch(query);
  const { data: folders = [] } = useFolders();
  const q = query.trim();

  if (search.status === "loading") {
    return <Text className="p-6 text-center text-xs text-muted">Szukam…</Text>;
  }
  if (search.status === "error") {
    return (
      <Text className={common.error}>
        Nie udało się wyszukać. Spróbuj ponownie.
      </Text>
    );
  }
  return (
    <FlatList
      data={search.results}
      keyExtractor={(result) => String(result.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="pb-8"
      ListEmptyComponent={
        <Text className="p-6 text-center text-xs text-muted">
          Nic nie znaleziono.
        </Text>
      }
      renderItem={({ item: result }) => {
        const path = folderPath(folders, result.folderId ?? null)
          .map((folder) => folder.name)
          .join(" / ");
        const more = result.lines.length - LINES_SHOWN;
        return (
          <Pressable
            className="mx-4 flex-row gap-[13px] border-b border-row-line px-[3px] py-3 active:opacity-60"
            accessibilityRole="button"
            onPress={() => openItem(result, q)}
          >
            <Ionicons
              name={isNote(result) ? "document-text-outline" : "easel-outline"}
              size={22}
              color={colors.icon}
            />
            <View className="flex-1 gap-1">
              <Text numberOfLines={1} className={common.rowTitle}>
                <Marked text={result.name} query={q} />
              </Text>
              {path !== "" && (
                <Text numberOfLines={1} className={common.muted}>
                  {path}
                </Text>
              )}
              {result.lines.slice(0, LINES_SHOWN).map((line) => (
                <Text
                  key={line.number}
                  numberOfLines={2}
                  className="text-xs text-ink-soft"
                >
                  <Text className="font-utility text-muted">
                    {line.number}:{" "}
                  </Text>
                  <Marked text={line.text} query={q} />
                </Text>
              ))}
              {more > 0 && (
                <Text className={common.muted}>i {more} więcej</Text>
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
