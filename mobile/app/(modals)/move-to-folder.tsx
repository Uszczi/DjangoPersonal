import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { flattenTree, subtreeIds } from "@personal/shared/folderTree";
import { useFolders, useMoveFolder } from "@personal/shared/queries/folders";
import {
  useMoveWhiteboard,
  useWhiteboards,
} from "@personal/shared/queries/whiteboards";

import { useTheme } from "@/theme";
import { common } from "@/ui/classes";

/**
 * Moves a Folder or an item (`?target=folder|item&id=`) into another Folder or
 * to the top level. A Folder can't go into itself or its subfolders, so those
 * are left out.
 */
export default function MoveToFolderScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    target: "folder" | "item";
    id: string;
  }>();
  const isFolder = params.target === "folder";
  const id = Number(params.id);
  const { data: folders = [] } = useFolders();
  const { data: items = [] } = useWhiteboards();
  const moveFolder = useMoveFolder();
  const moveItem = useMoveWhiteboard();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const current = isFolder
    ? (folders.find((folder) => folder.id === id)?.parentId ?? null)
    : (items.find((item) => item.id === id)?.folderId ?? null);
  const excluded = isFolder ? subtreeIds(folders, id) : new Set<number>();
  const choices = [
    { id: null, name: "Najwyższy poziom", depth: 0 },
    ...flattenTree(folders)
      .filter(({ folder }) => !excluded.has(folder.id))
      .map(({ folder, depth }) => ({
        id: folder.id as number | null,
        name: folder.name,
        depth: depth + 1,
      })),
  ];

  async function move(folderId: number | null) {
    if (folderId === current) {
      router.back();
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      if (isFolder) await moveFolder.mutateAsync({ id, parentId: folderId });
      else await moveItem.mutateAsync({ id, folderId });
      router.back();
    } catch (err) {
      setError(await apiErrorMessage(err));
      setIsSaving(false);
    }
  }

  return (
    <View className={common.screen}>
      {error !== "" && <Text className={common.error}>{error}</Text>}
      <ScrollView contentContainerClassName="py-2">
        {choices.map((choice) => {
          const isCurrent = choice.id === current;
          return (
            <Pressable
              key={choice.id ?? "top"}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent, disabled: isSaving }}
              disabled={isSaving}
              onPress={() => void move(choice.id)}
              className="mx-4 min-h-[52px] flex-row items-center gap-3 border-b border-row-line active:opacity-60"
              // Indented by depth, which no fixed class can express.
              style={{ paddingLeft: 4 + choice.depth * 18 }}
            >
              <Ionicons
                name={choice.id === null ? "home-outline" : "folder-outline"}
                size={20}
                color={colors.icon}
              />
              <Text
                numberOfLines={1}
                className={
                  isCurrent
                    ? "flex-1 text-[15px] font-bold text-ink"
                    : "flex-1 text-[15px] font-medium text-ink"
                }
              >
                {choice.name}
              </Text>
              {isCurrent && (
                <Ionicons name="checkmark" size={20} color={colors.signal} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
