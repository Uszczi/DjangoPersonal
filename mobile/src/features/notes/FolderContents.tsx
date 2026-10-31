import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { childFolders } from "@personal/shared/folderTree";
import type {
  FolderResponse,
  WhiteboardResponse,
} from "@personal/shared/generated/api";
import {
  FOLDERS_LOAD_ERROR,
  WHITEBOARDS_LOAD_ERROR,
} from "@personal/shared/loadErrors";
import { useFolders } from "@personal/shared/queries/folders";
import {
  useCreateItem,
  useWhiteboards,
} from "@personal/shared/queries/whiteboards";

import { useTheme } from "@/theme";
import { common } from "@/ui/classes";
import { Fab } from "@/ui/Fab";
import { Sheet, SheetItem } from "@/ui/Sheet";

import {
  NotatnikActionsSheet,
  type NotatnikTarget,
} from "@/features/notes/NotatnikActionsSheet";
import {
  formatChanged,
  isNote,
  openFolder,
  openItem,
} from "@/features/notes/navigation";

type Row =
  | { type: "folder"; folder: FolderResponse; count: number }
  | { type: "item"; item: WhiteboardResponse };

function countLabel(count: number) {
  if (count === 0) return "pusty";
  if (count === 1) return "1 element";
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} elementy`;
  }
  return `${count} elementów`;
}

/**
 * One level of the Notatnik: the Folders inside `folderId` (`null`: the top
 * level), then its Notatki and Tablice, newest first. A tap opens, a long
 * press offers rename, move and delete; the "+" adds a Notatka or a Folder
 * here.
 */
export function FolderContents({ folderId }: { folderId: number | null }) {
  const { colors } = useTheme();
  const folders = useFolders();
  const whiteboards = useWhiteboards();
  const createItem = useCreateItem();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [target, setTarget] = useState<NotatnikTarget | null>(null);
  const [actionError, setActionError] = useState("");

  const allFolders = folders.data ?? [];
  const allItems = whiteboards.data ?? [];
  const rows: Row[] = [
    ...childFolders(allFolders, folderId).map((folder) => ({
      type: "folder" as const,
      folder,
      count:
        childFolders(allFolders, folder.id).length +
        allItems.filter((item) => item.folderId === folder.id).length,
    })),
    ...allItems
      .filter((item) => (item.folderId ?? null) === folderId)
      .map((item) => ({ type: "item" as const, item })),
  ];
  const isLoading = folders.isPending || whiteboards.isPending;
  const loadError = whiteboards.isError
    ? WHITEBOARDS_LOAD_ERROR
    : folders.isError
      ? FOLDERS_LOAD_ERROR
      : "";
  const errorMessage = actionError || loadError;

  async function refresh() {
    setIsRefreshing(true);
    await Promise.all([folders.refetch(), whiteboards.refetch()]);
    setIsRefreshing(false);
  }

  async function createNote() {
    setIsAddOpen(false);
    setActionError("");
    try {
      const created = await createItem.mutateAsync({
        kind: "markdown",
        folderId,
      });
      openItem(created);
    } catch (error) {
      setActionError(await apiErrorMessage(error));
    }
  }

  function createFolder() {
    setIsAddOpen(false);
    router.push({
      pathname: "/notatnik-name",
      params:
        folderId === null
          ? { target: "folder" }
          : { target: "folder", parentId: folderId },
    });
  }

  return (
    <View className={common.screen}>
      {errorMessage !== "" && (
        <Text className={common.error}>{errorMessage}</Text>
      )}
      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.type === "folder" ? `f${row.folder.id}` : `i${row.item.id}`
        }
        contentContainerClassName="pb-28"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (isLoading && loadError === "")}
            onRefresh={() => void refresh()}
          />
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <Text className="p-6 text-center text-xs text-muted">
              {folderId === null
                ? "Brak notatek. Dodaj pierwszą przyciskiem +."
                : "Ten folder jest pusty."}
            </Text>
          )
        }
        renderItem={({ item: row }) =>
          row.type === "folder" ? (
            <Pressable
              className={`${common.row} active:opacity-60`}
              accessibilityRole="button"
              accessibilityLabel={`Folder ${row.folder.name}`}
              accessibilityHint="Przytrzymaj, aby zobaczyć opcje"
              onPress={() => openFolder(row.folder)}
              onLongPress={() =>
                setTarget({ type: "folder", folder: row.folder })
              }
            >
              <Ionicons name="folder" size={22} color={colors.accent} />
              <View className="flex-1">
                <Text numberOfLines={1} className={common.rowTitle}>
                  {row.folder.name}
                </Text>
                <Text className={common.rowSubtitle}>
                  {countLabel(row.count)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.icon} />
            </Pressable>
          ) : (
            <Pressable
              className={`${common.row} active:opacity-60`}
              accessibilityRole="button"
              accessibilityLabel={
                isNote(row.item)
                  ? `Notatka ${row.item.name}`
                  : `Tablica ${row.item.name}`
              }
              accessibilityHint="Przytrzymaj, aby zobaczyć opcje"
              onPress={() => openItem(row.item)}
              onLongPress={() => setTarget({ type: "item", item: row.item })}
            >
              <Ionicons
                name={
                  isNote(row.item) ? "document-text-outline" : "easel-outline"
                }
                size={22}
                color={colors.icon}
              />
              <View className="flex-1">
                <Text
                  numberOfLines={1}
                  className={
                    isNote(row.item)
                      ? "text-sm font-medium text-ink"
                      : "text-sm font-medium text-muted"
                  }
                >
                  {row.item.name}
                </Text>
                <Text className={common.rowSubtitle}>
                  {isNote(row.item)
                    ? formatChanged(row.item.updatedAt)
                    : `Tablica · ${formatChanged(row.item.updatedAt)}`}
                </Text>
              </View>
            </Pressable>
          )
        }
      />
      <Fab accessibilityLabel="Dodaj" onPress={() => setIsAddOpen(true)} />
      {isAddOpen && (
        <Sheet title="Dodaj" onClose={() => setIsAddOpen(false)}>
          <SheetItem
            icon="document-text-outline"
            label="Nowa notatka"
            onPress={() => void createNote()}
          />
          <SheetItem
            icon="folder-outline"
            label="Nowy folder"
            onPress={createFolder}
          />
        </Sheet>
      )}
      {target && (
        <NotatnikActionsSheet
          target={target}
          onClose={() => setTarget(null)}
          onError={setActionError}
        />
      )}
    </View>
  );
}
