import { Tabs, router } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { common, form } from "@/ui/classes";
import { LogoMark } from "@/ui/LogoMark";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { FolderContents } from "@/features/notes/FolderContents";
import { SearchResults } from "@/features/notes/SearchResults";

/**
 * The Notatnik tab: the top level of the Folders and Notatki, a search of the
 * whole Notatnik, and the way to ask the Notatki a question.
 */
export default function NotesScreen() {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");

  function toggleSearch() {
    setIsSearching((open) => !open);
    setQuery("");
  }

  return (
    <>
      <Tabs.Screen
        options={{
          header: () => (
            <ScreenHeader
              left={<LogoMark />}
              title="Notatnik"
              actions={[
                {
                  icon: isSearching ? "close" : "search",
                  accessibilityLabel: isSearching
                    ? "Zamknij wyszukiwanie"
                    : "Szukaj w Notatniku",
                  onPress: toggleSearch,
                },
                {
                  icon: "sparkles-outline",
                  accessibilityLabel: "Zapytaj Notatki",
                  onPress: () => router.push("/notes/ask"),
                },
              ]}
            />
          ),
        }}
      />
      <View className={common.screen}>
        {isSearching && (
          <View className="px-4 pt-3 pb-1">
            <TextInput
              className={form.input}
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Szukaj w nazwach i treści…"
              placeholderTextColorClassName="accent-hint"
              accessibilityLabel="Szukaj w Notatniku"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        )}
        {isSearching && query.trim() !== "" ? (
          <SearchResults query={query} />
        ) : (
          <FolderContents folderId={null} />
        )}
      </View>
    </>
  );
}
